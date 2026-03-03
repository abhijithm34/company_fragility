from pathlib import Path

import pandas as pd

from .config import FEATURE_COLS, ID_COLS, TARGET_COL


def load_feature_dataset(path: Path) -> pd.DataFrame:
    """Load the engineered feature dataset and perform basic cleaning."""
    df = pd.read_csv(path)

    expected_cols = set(FEATURE_COLS + ID_COLS + [TARGET_COL])
    missing = [c for c in expected_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing expected columns in dataset: {missing}")

    df["Quarter"] = pd.to_datetime(df["Quarter"])
    df = df.sort_values(ID_COLS).reset_index(drop=True)

    df = df.dropna(subset=[TARGET_COL])
    df = df.dropna(subset=FEATURE_COLS, how="any")

    df[TARGET_COL] = df[TARGET_COL].astype(int)

    return df

