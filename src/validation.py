"""Time-series cross-validation utilities."""
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, average_precision_score, roc_auc_score

from .config import FEATURE_COLS, TARGET_COL


def time_series_cv_splits(
    df: pd.DataFrame,
    n_splits: int = 5,
) -> list[tuple[pd.Series, pd.Series]]:
    """Yield (train_mask, test_mask) for expanding-window time-series CV.

    Quarters are sorted; fold i uses quarters [0, train_end) for train and
    [train_end, test_end) for test; train expands each fold.
    """
    unique_quarters = np.sort(df["Quarter"].unique())
    n = len(unique_quarters)
    if n < 2 or n_splits < 2:
        return []

    # Block size so we have n_splits test blocks
    block = max(1, n // (n_splits + 1))
    result = []
    for i in range(n_splits):
        train_end = (i + 1) * block
        test_end = min(train_end + block, n)
        if train_end >= n or test_end <= train_end:
            continue
        train_quarters = unique_quarters[:train_end]
        test_quarters = unique_quarters[train_end:test_end]
        if len(train_quarters) < 2 or len(test_quarters) < 1:
            continue
        train_mask = df["Quarter"].isin(train_quarters)
        test_mask = df["Quarter"].isin(test_quarters)
        result.append((train_mask, test_mask))
    return result


def run_time_series_cv(
    df: pd.DataFrame,
    model_builder,
    n_splits: int = 5,
) -> dict:
    """Run time-series CV and return aggregate metrics."""
    splits = time_series_cv_splits(df, n_splits=n_splits)
    if not splits:
        return {}

    accs, rocs, prs = [], [], []
    for train_mask, test_mask in splits:
        X_tr = df.loc[train_mask, FEATURE_COLS].values
        y_tr = df.loc[train_mask, TARGET_COL].values.astype(int)
        X_te = df.loc[test_mask, FEATURE_COLS].values
        y_te = df.loc[test_mask, TARGET_COL].values.astype(int)
        if len(np.unique(y_te)) < 2:
            continue
        model = model_builder(y_tr)
        model.fit(X_tr, y_tr)
        proba = model.predict_proba(X_te)[:, 1]
        pred = (proba >= 0.5).astype(int)
        accs.append(accuracy_score(y_te, pred))
        rocs.append(roc_auc_score(y_te, proba))
        prs.append(average_precision_score(y_te, proba))

    if not accs:
        return {}
    return {
        "accuracy_mean": float(np.mean(accs)),
        "accuracy_std": float(np.std(accs)),
        "roc_auc_mean": float(np.mean(rocs)),
        "roc_auc_std": float(np.std(rocs)),
        "pr_auc_mean": float(np.mean(prs)),
        "pr_auc_std": float(np.std(prs)),
        "n_folds": len(accs),
    }
