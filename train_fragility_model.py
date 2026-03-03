"""
Corporate Fragility Early Warning – ML Pipeline

End-to-end pipeline: preprocessing → train/test split → XGBoost training →
evaluation → model persistence. All metrics printed to terminal.
"""
import pickle

import numpy as np

from src.config import FEATURE_COLS, FEATURE_DATA_FILE, FEATURES_FILE, MODEL_FILE, TARGET_COL
from src.data_loading import load_feature_dataset
from src.evaluation import evaluate_model
from src.models import build_xgb_model
from src.splitting import time_based_train_test_split


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


def main():
    print("=" * 60)
    print("CORPORATE FRAGILITY EARLY WARNING – ML PIPELINE")
    print("=" * 60)

    # Step 1: Data loading & preprocessing
    print("\n[STEP 1] Data loading & preprocessing")
    print("-" * 40)
    df = load_feature_dataset(FEATURE_DATA_FILE)
    print(f"  Loaded: {len(df)} rows")
    print(f"  Companies: {df['Company'].nunique()}")
    print(f"  Quarters: {df['Quarter'].min()} to {df['Quarter'].max()}")
    print(f"  Features: {FEATURE_COLS}")
    print(f"  Target: {TARGET_COL}")
    dist = df[TARGET_COL].value_counts().sort_index()
    print(f"  Class distribution: 0={dist.get(0, 0)}, 1={dist.get(1, 0)}")

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

    # Step 3: Model training
    print("\n[STEP 3] XGBoost model training")
    print("-" * 40)
    model = build_xgb_model(y_train)
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

