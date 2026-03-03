"""Build a feature dataset and Stress_Label from raw financials."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.altman import add_altman_z, stress_label_from_z
from src.config import RAW_FINANCIALS_FILE

RAW_COLS = [
    "Company", "Quarter", "Sales", "Total_Assets", "Total_Liabilities",
    "Short_Term_Debt", "Long_Term_Debt", "EBIT", "Interest_Expense",
    "Operating_Cash_Flow", "Market_Cap", "Retained_Earnings",
    "Current_Assets", "Current_Liabilities",
]

OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"
OUTPUT_FILE = OUTPUT_DIR / "feature_dataset_from_raw.csv"

# Defaults when macro not in raw
DEFAULT_REPO_RATE = 5.0
DEFAULT_LEVERAGE_REPO = 1.5


def build_features_at_t(df: pd.DataFrame) -> pd.DataFrame:
    """Add feature columns from raw financials."""
    out = df.copy()
    ta = out["Total_Assets"]
    tl = out["Total_Liabilities"]
    out["X1"] = (out["Current_Assets"] - out["Current_Liabilities"]).clip(lower=0) / ta.replace(0, np.nan)
    out["X2"] = out["Retained_Earnings"] / ta.replace(0, np.nan)
    out["X3"] = out["EBIT"] / ta.replace(0, np.nan)
    out["X4"] = out["Market_Cap"] / tl.replace(0, np.nan)
    out["X5"] = out["Sales"] / ta.replace(0, np.nan)
    out["OCF_TA"] = out["Operating_Cash_Flow"] / ta.replace(0, np.nan)
    ie = out["Interest_Expense"].replace(0, np.nan)
    out["Interest_Coverage"] = out["EBIT"] / ie
    out["Debt_Assets"] = (out["Short_Term_Debt"] + out["Long_Term_Debt"]) / ta.replace(0, np.nan)
    out["Repo_Rate"] = DEFAULT_REPO_RATE
    out["Leverage_Repo"] = out["Debt_Assets"] * (DEFAULT_REPO_RATE / 10.0)
    out["Leverage_Repo"] = out["Leverage_Repo"].fillna(DEFAULT_LEVERAGE_REPO)
    return out


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(RAW_FINANCIALS_FILE)
    df["Quarter"] = pd.to_datetime(df["Quarter"])
    df = df.sort_values(["Company", "Quarter"]).reset_index(drop=True)

    for c in RAW_COLS:
        if c not in df.columns:
            raise ValueError(f"Missing column in raw financials: {c}")

    df = add_altman_z(df)

    # Map (Company, Quarter) -> Z at that quarter
    z_at_t = df.set_index(["Company", "Quarter"])["Altman_Z"]

    # For each row at t, get Z at t+4 (same company)
    quarters_sorted = np.sort(df["Quarter"].unique())
    nq = len(quarters_sorted)
    q_to_idx = {pd.Timestamp(q): i for i, q in enumerate(quarters_sorted)}

    def z_at_t_plus_4(row):
        company, q_t = row["Company"], row["Quarter"]
        q_t = pd.Timestamp(q_t)
        idx = q_to_idx.get(q_t)
        if idx is None or idx + 4 >= nq:
            return np.nan
        q_t4 = quarters_sorted[idx + 4]
        return z_at_t.get((company, pd.Timestamp(q_t4)), np.nan)

    df["Z_tplus4"] = df.apply(z_at_t_plus_4, axis=1)
    df["Stress_Label"] = df["Z_tplus4"].apply(stress_label_from_z)
    df = df.dropna(subset=["Z_tplus4"]).drop(columns=["Z_tplus4", "Altman_Z"])

    df = build_features_at_t(df)

    feature_cols = [
        "X1", "X2", "X3", "X4", "X5",
        "OCF_TA", "Interest_Coverage", "Debt_Assets", "Repo_Rate", "Leverage_Repo",
    ]
    out_cols = ["Company", "Quarter"] + feature_cols + ["Stress_Label"]
    df = df.dropna(subset=feature_cols)[out_cols]
    df["Stress_Label"] = df["Stress_Label"].astype(int)

    df.to_csv(OUTPUT_FILE, index=False)
    print(f"Saved {len(df)} rows to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
