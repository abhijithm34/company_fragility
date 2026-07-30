import numpy as np
import pandas as pd

from .config import TARGET_COL


def time_based_train_test_split(df: pd.DataFrame, test_fraction: float = 0.2):
    """Create a time-based train/test split on the Quarter column.

    - Train: earlier quarters.
    - Test : later quarters.

    If the default split leads to a test set with only one class (e.g. only
    non-distressed firms), we shift the cutoff so that the test period starts
    from the last quarter in which a distressed sample (label=1) appears.
    This simulates a realistic backtest where the evaluation period still
    contains distress events.
    """
    unique_quarters = np.sort(df["Quarter"].unique())
    if len(unique_quarters) < 2:
        raise ValueError("Not enough distinct quarters for a time-based split.")

    split_idx = int((1.0 - test_fraction) * len(unique_quarters))
    split_idx = max(1, min(split_idx, len(unique_quarters) - 1))
    cutoff = unique_quarters[split_idx]

    train_mask = df["Quarter"] < cutoff
    test_mask = df["Quarter"] >= cutoff

    # Ensure test has both classes
    y_test = df.loc[test_mask, TARGET_COL]
    if y_test.nunique() < 2:
        distressed = df[df[TARGET_COL] == 1]
        if not distressed.empty:
            last_pos_quarter = distressed["Quarter"].max()
            new_split_idx = np.searchsorted(unique_quarters, last_pos_quarter, side="left")
            new_split_idx = max(1, min(new_split_idx, len(unique_quarters) - 1))
            cutoff = unique_quarters[new_split_idx]
            train_mask = df["Quarter"] < cutoff
            test_mask = df["Quarter"] >= cutoff

    return train_mask, test_mask, cutoff

