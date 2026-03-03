"""
Corporate Fragility Early Warning – ML Pipeline

End-to-end pipeline: preprocessing → train/test split → XGBoost training →
evaluation → model persistence. All metrics printed to terminal.

Options:
  --data PATH    Override the feature CSV path (default: auto-built from raw).
  --tune         Run time-series CV with hyperparameter grid; use best params.
  --calibrate    Fit probability calibration (sigmoid) on train holdout; save calibrated model.
"""
import argparse
import pickle

import numpy as np
from sklearn.linear_model import LogisticRegression
import subprocess
from pathlib import Path

from src.config import (
    FEATURE_COLS,
    FEATURE_DATA_FROM_RAW_FILE,
    FEATURES_FILE,
    MODEL_FILE,
    TARGET_COL,
)
from src.data_loading import load_feature_dataset
from src.evaluation import evaluate_model
from src.models import build_xgb_model
from src.splitting import time_based_train_test_split
from src.validation import run_time_series_cv, time_series_cv_splits


class _CalibratedModel:
    """Wrapper that applies Platt scaling to base model probabilities."""
    def __init__(self, base, platt):
        self.base = base
        self.platt = platt
    def predict_proba(self, X):
        p = self.base.predict_proba(X)[:, 1].reshape(-1, 1)
        p_cal = self.platt.predict_proba(p)[:, 1]
        return np.column_stack([1 - p_cal, p_cal])


def save_model(model, feature_cols) -> None:
    """Persist model and feature list for later inference."""
    with open(MODEL_FILE, "wb") as f:
        pickle.dump(model, f)

    with open(FEATURES_FILE, "w", encoding="utf-8") as f:
        for col in feature_cols:
            f.write(f"{col}\n")

    print(f"\nSaved model to {MODEL_FILE.resolve()}")
    print(f"Saved feature list to {FEATURES_FILE.resolve()}")


def score_latest_quarter(df, model):
    """Compute Corporate Fragility Score for the latest quarter for each company."""
    latest_quarter = df["Quarter"].max()
    latest_df = df[df["Quarter"] == latest_quarter].copy()

    X_latest = latest_df[FEATURE_COLS].values
    scores = model.predict_proba(X_latest)[:, 1]

    latest_df["Corporate_Fragility_Score"] = scores

    print(f"\nSample Corporate Fragility Scores for latest quarter ({latest_quarter.date()}):")
    print(
        latest_df[["Company", "Quarter", "Corporate_Fragility_Score"]]
        .sort_values("Corporate_Fragility_Score", ascending=False)
        .head(10)
        .to_string(index=False)
    )


# Grid for --tune (time-series CV)
TUNE_GRID = [
    {"max_depth": 2, "n_estimators": 100, "learning_rate": 0.05},
    {"max_depth": 3, "n_estimators": 150, "learning_rate": 0.08},
    {"max_depth": 4, "n_estimators": 200, "learning_rate": 0.06},
]


def main():
    parser = argparse.ArgumentParser(description="Train corporate fragility XGBoost model.")
    parser.add_argument(
        "--data",
        default=None,
        help="Path to feature CSV (optional). If omitted, dataset is built from raw automatically.",
    )
    parser.add_argument("--tune", action="store_true", help="Run time-series CV hyperparameter tuning.")
    parser.add_argument("--calibrate", action="store_true", help="Fit probability calibration; save calibrated model.")
    args = parser.parse_args()

    # Default: always use the dataset generated from raw financials
    if args.data is None:
        data_path = FEATURE_DATA_FROM_RAW_FILE
        if not data_path.exists():
            print("\n[PRE-STEP] Building feature dataset from raw financials")
            print("-" * 40)
            cmd = ["python", "scripts/build_dataset_from_raw.py"]
            subprocess.check_call(cmd, cwd=str(Path(__file__).resolve().parent))
    else:
        data_path = Path(args.data)

    print("=" * 60)
    print("CORPORATE FRAGILITY EARLY WARNING – ML PIPELINE")
    print("=" * 60)

    # Step 1: Data loading & preprocessing
    print("\n[STEP 1] Data loading & preprocessing")
    print("-" * 40)
    df = load_feature_dataset(data_path)
    print(f"  Data: {data_path}")
    print(f"  Loaded: {len(df)} rows")
    print(f"  Companies: {df['Company'].nunique()}")
    print(f"  Quarters: {df['Quarter'].min()} to {df['Quarter'].max()}")
    print(f"  Features: {FEATURE_COLS}")
    print(f"  Target: {TARGET_COL}")
    dist = df[TARGET_COL].value_counts().sort_index()
    print(f"  Class distribution: 0={dist.get(0, 0)}, 1={dist.get(1, 0)}")

    # Optional: Hyperparameter tuning via time-series CV
    best_params = None
    if args.tune:
        print("\n[STEP 1b] Time-series CV hyperparameter tuning")
        print("-" * 40)
        best_score = -1.0
        for params in TUNE_GRID:
            def builder(y):
                return build_xgb_model(y, param_overrides=params)
            metrics = run_time_series_cv(df, builder, n_splits=5)
            if not metrics:
                continue
            score = metrics["roc_auc_mean"]
            print(f"  {params} -> ROC-AUC mean={score:.4f} (+/- {metrics['roc_auc_std']:.4f})")
            if score > best_score:
                best_score = score
                best_params = params
        if best_params:
            print(f"  Best params: {best_params}")
        else:
            print("  No valid CV folds; using default params.")

    # Step 2: Time-based train/test split
    print("\n[STEP 2] Time-based train/test split")
    print("-" * 40)
    train_mask, test_mask, cutoff = time_based_train_test_split(df)
    X_train = df.loc[train_mask, FEATURE_COLS].values
    y_train = df.loc[train_mask, TARGET_COL].values.astype(int)
    train_quarters = df.loc[train_mask, "Quarter"].values
    X_test = df.loc[test_mask, FEATURE_COLS].values
    y_test = df.loc[test_mask, TARGET_COL].values.astype(int)
    test_quarters = df.loc[test_mask, "Quarter"].values
    print(f"  Train samples: {len(X_train)}")
    print(f"  Test samples:  {len(X_test)}")
    print(f"  Cutoff quarter: {cutoff}")

    # Step 3: Model training (and optional calibration)
    print("\n[STEP 3] XGBoost model training")
    print("-" * 40)
    model = build_xgb_model(y_train, param_overrides=best_params)
    if args.calibrate:
        n_cal = max(100, len(X_train) // 5)
        X_tr, X_cal = X_train[:-n_cal], X_train[-n_cal:]
        y_tr, y_cal = y_train[:-n_cal], y_train[-n_cal:]
        model.fit(X_tr, y_tr)
        print("\n[STEP 3b] Probability calibration (Platt scaling on holdout)")
        print("-" * 40)
        p_cal = model.predict_proba(X_cal)[:, 1].reshape(-1, 1)
        platt = LogisticRegression(C=1e10, max_iter=1000)
        platt.fit(p_cal, y_cal)
        model = _CalibratedModel(model, platt)
        print("  Calibration complete.")
    else:
        model.fit(X_train, y_train)
    print("  Training complete.")

    # Step 4: Evaluation (metrics to terminal)
    print("\n[STEP 4] Model evaluation")
    print("-" * 40)
    y_train_prob = model.predict_proba(X_train)[:, 1]
    y_test_prob = model.predict_proba(X_test)[:, 1]
    evaluate_model(
        y_train,
        y_train_prob,
        y_test,
        y_test_prob,
        train_quarters,
        test_quarters,
        cutoff,
    )

    # Step 5: Persist model & feature list
    print("\n[STEP 5] Save model & feature list")
    print("-" * 40)
    save_model(model, FEATURE_COLS)

    # Step 6: Latest-quarter scores
    print("\n[STEP 6] Corporate Fragility Scores (latest quarter)")
    print("-" * 40)
    score_latest_quarter(df, model)

    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()

