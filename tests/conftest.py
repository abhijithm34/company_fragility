"""Shared pytest fixtures for the company_fragility test suite."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Ensure project root is on sys.path so src package is importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.config import FEATURE_COLS, ID_COLS, RAW_FINANCIALS_FILE, TARGET_COL


@pytest.fixture
def project_root():
    """Return project root Path."""
    return PROJECT_ROOT


@pytest.fixture
def raw_financials_path():
    """Return path to raw_financials.csv (for integration tests)."""
    return RAW_FINANCIALS_FILE


@pytest.fixture
def sample_raw_row():
    """A single raw financial row as a dict."""
    return {
        "Company": "TestCorp",
        "Quarter": "2020-03-31",
        "Sales": 1000.0,
        "Total_Assets": 5000.0,
        "Total_Liabilities": 2000.0,
        "Short_Term_Debt": 300.0,
        "Long_Term_Debt": 700.0,
        "EBIT": 400.0,
        "Interest_Expense": 100.0,
        "Operating_Cash_Flow": 500.0,
        "Market_Cap": 8000.0,
        "Retained_Earnings": 1500.0,
        "Current_Assets": 2000.0,
        "Current_Liabilities": 1000.0,
        "RBI_Repo_Rate": 5.0,
    }


@pytest.fixture
def sample_raw_df(sample_raw_row):
    """DataFrame with multiple rows of raw financial data."""
    rows = []
    quarters = pd.date_range("2018-03-31", periods=12, freq="QE")
    for i, q in enumerate(quarters):
        row = sample_raw_row.copy()
        row["Quarter"] = q.strftime("%Y-%m-%d")
        row["Company"] = "TestCorp"
        row["Sales"] = 1000.0 + i * 50
        row["EBIT"] = 400.0 - i * 20
        rows.append(row)
    return pd.DataFrame(rows)


@pytest.fixture
def sample_feature_df():
    """DataFrame with engineered feature columns + ID cols + target."""
    np.random.seed(42)
    n = 40
    quarters = pd.date_range("2018-03-31", periods=10, freq="QE")
    companies = ["A", "B", "C", "D"]
    rows = []
    for company in companies:
        for q in quarters:
            row = {"Company": company, "Quarter": q}
            for col in FEATURE_COLS:
                row[col] = np.random.uniform(0, 5)
            row[TARGET_COL] = np.random.choice([0, 1], p=[0.8, 0.2])
            rows.append(row)
    df = pd.DataFrame(rows)
    df["Quarter"] = pd.to_datetime(df["Quarter"])
    return df


@pytest.fixture
def empty_df():
    """An empty DataFrame with correct columns."""
    cols = ID_COLS + FEATURE_COLS + [TARGET_COL]
    return pd.DataFrame(columns=cols)


@pytest.fixture
def tmp_csv(tmp_path, sample_feature_df):
    """Write sample feature df to a temporary CSV and return path."""
    p = tmp_path / "test_features.csv"
    sample_feature_df.to_csv(p, index=False)
    return p
