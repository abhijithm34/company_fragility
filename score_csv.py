"""Score a CSV of next-quarter data with the trained XGBoost model.
Outputs predicted probability, label, and SHAP feature contributions per row.
"""
import argparse
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
import shap

from src.config import FEATURE_COLS, FEATURES_FILE, MODEL_FILE

# Risk category tiers by predicted probability (upper bound exclusive, last tier inclusive)
RISK_TIERS = [
    (0.2, "Very Safe"),
    (0.4, "Low Risk"),
    (0.6, "Moderate Risk"),
    (0.8, "High Risk"),
    (1.01, "Severe Risk"),
]


def risk_category_from_probability(p: float) -> str:
    """Map predicted probability to risk category label."""
    if np.isnan(p):
        return "Unknown"
    for upper, label in RISK_TIERS:
        if p < upper:
            return label
    return RISK_TIERS[-1][1]


RAW_COLS = [
    "Company",
    "Quarter",
    "Sales",
    "Total_Assets",
    "Total_Liabilities",
    "Short_Term_Debt",
    "Long_Term_Debt",
    "EBIT",
    "Interest_Expense",
    "Operating_Cash_Flow",
    "Market_Cap",
    "Retained_Earnings",
    "Current_Assets",
    "Current_Liabilities",
    "RBI_Repo_Rate",
]

DEFAULT_REPO_RATE = 5.0
DEFAULT_LEVERAGE_REPO = 1.5


def ensure_features(df: pd.DataFrame) -> pd.DataFrame:
    """Return a DataFrame that contains FEATURE_COLS.

    If FEATURE_COLS are already present, returns df unchanged.
    Otherwise, if RAW_COLS are present, compute the engineered
    features from raw financials to match the training schema.
    """
    # If all engineered features are already present, nothing to do
    if all(c in df.columns for c in FEATURE_COLS):
        return df

    # Otherwise expect raw financial columns
    missing_raw = [c for c in RAW_COLS if c not in df.columns]
    if missing_raw:
        raise ValueError(
            f"Input CSV must either contain all feature columns {FEATURE_COLS} "
            f"or raw financial columns {RAW_COLS}. Missing: {missing_raw}"
        )

    out = df.copy()
    ta = out["Total_Assets"]
    tl = out["Total_Liabilities"]

    # Replicate training feature engineering (see scripts/build_dataset_from_raw.py)
    out["X1"] = (out["Current_Assets"] - out["Current_Liabilities"]).clip(lower=0) / ta.replace(0, np.nan)
    out["X2"] = out["Retained_Earnings"] / ta.replace(0, np.nan)
    out["X3"] = out["EBIT"] / ta.replace(0, np.nan)
    out["X4"] = out["Market_Cap"] / tl.replace(0, np.nan)
    out["X5"] = out["Sales"] / ta.replace(0, np.nan)
    out["OCF_TA"] = out["Operating_Cash_Flow"] / ta.replace(0, np.nan)
    ie = out["Interest_Expense"].replace(0, np.nan)
    out["Interest_Coverage"] = out["EBIT"] / ie
    out["Debt_Assets"] = (out["Short_Term_Debt"] + out["Long_Term_Debt"]) / ta.replace(0, np.nan)
    # Use real repo rate from input if available, else fall back to default
    if "RBI_Repo_Rate" in out.columns:
        out["Repo_Rate"] = out["RBI_Repo_Rate"]
    else:
        out["Repo_Rate"] = DEFAULT_REPO_RATE
    out["Leverage_Repo"] = out["Debt_Assets"] * (out["Repo_Rate"] / 10.0)
    out["Leverage_Repo"] = out["Leverage_Repo"].fillna(DEFAULT_LEVERAGE_REPO)

    # Drop any rows where features could not be computed
    out = out.dropna(subset=FEATURE_COLS)
    return out


def main():
    parser = argparse.ArgumentParser(description="Score a CSV with the trained fragility model.")
    parser.add_argument(
        "--input",
        "-i",
        required=True,
        help="Path to input CSV (either raw financials or engineered feature columns).",
    )
    parser.add_argument("--output", "-o", required=True, help="Path to output CSV with scores.")
    args = parser.parse_args()

    inp = Path(args.input)
    out = Path(args.output)
    if not inp.exists():
        raise FileNotFoundError(f"Input file not found: {inp}")

    with open(FEATURES_FILE, "r", encoding="utf-8") as f:
        expected_features = [line.strip() for line in f if line.strip()]
    if expected_features != FEATURE_COLS:
        expected_features = FEATURE_COLS

    df = pd.read_csv(inp)
    df = ensure_features(df)

    # Final check that engineered features are present
    missing = [c for c in expected_features if c not in df.columns]
    if missing:
        raise ValueError(f"After feature construction, missing feature columns: {missing}")

    with open(MODEL_FILE, "rb") as f:
        model = pickle.load(f)

    X = df[expected_features].values
    proba = model.predict_proba(X)[:, 1]
    pred = (proba >= 0.5).astype(int)

    # SHAP contributions for model explainability (contribution to P(distress))
    try:
        explainer = shap.TreeExplainer(model)
        shap_vals = explainer.shap_values(X)
        # Binary classifier: shap_vals can be (n_samples, n_features) for class 1
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[1] if len(shap_vals) > 1 else shap_vals[0]
        shap_vals = np.asarray(shap_vals)
        if shap_vals.ndim == 3:
            shap_vals = shap_vals[:, 1, :]
        for i, col in enumerate(expected_features):
            if i < shap_vals.shape[1]:
                out_col = f"shap_{col}"
                df[out_col] = np.round(shap_vals[:, i], 6)
    except Exception as e:
        print(f"SHAP explanation skipped: {e}")

    risk_categories = np.array([risk_category_from_probability(pr) for pr in proba])

    out_df = df.copy()
    out_df["predicted_probability"] = proba
    out_df["predicted_label"] = pred
    out_df["risk_category"] = risk_categories
    out_df.to_csv(out, index=False)
    print(f"Saved {len(out_df)} rows to {out}")


if __name__ == "__main__":
    main()
