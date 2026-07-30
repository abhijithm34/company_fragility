"""Tests for scripts/build_dataset_from_raw.py feature engineering."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Add project root so scripts module can find src
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.build_dataset_from_raw import build_features_at_t, RAW_COLS
from src.config import RAW_FINANCIALS_FILE


class TestBuildFeaturesAtT:
    """Tests for build_features_at_t."""

    def test_happy_path(self, sample_raw_df):
        """Should add all expected feature columns."""
        result = build_features_at_t(sample_raw_df)
        expected_features = [
            "X1", "X2", "X3", "X4", "X5",
            "OCF_TA", "Interest_Coverage", "Debt_Assets",
            "Repo_Rate", "Leverage_Repo",
        ]
        for col in expected_features:
            assert col in result.columns, f"Missing column: {col}"

    def test_x1_working_capital_ratio(self, sample_raw_df):
        """X1 = clip(CA - CL, 0) / TA."""
        result = build_features_at_t(sample_raw_df)
        row = result.iloc[0]
        ca = sample_raw_df.iloc[0]["Current_Assets"]
        cl = sample_raw_df.iloc[0]["Current_Liabilities"]
        ta = sample_raw_df.iloc[0]["Total_Assets"]
        expected = max(ca - cl, 0) / ta
        assert row["X1"] == pytest.approx(expected, rel=1e-6)

    def test_x4_market_cap_over_liabilities(self, sample_raw_df):
        """X4 = Market_Cap / Total_Liabilities."""
        result = build_features_at_t(sample_raw_df)
        row = result.iloc[0]
        mc = sample_raw_df.iloc[0]["Market_Cap"]
        tl = sample_raw_df.iloc[0]["Total_Liabilities"]
        expected = mc / tl
        assert row["X4"] == pytest.approx(expected, rel=1e-6)

    def test_interest_coverage(self, sample_raw_df):
        """Interest_Coverage = EBIT / Interest_Expense."""
        result = build_features_at_t(sample_raw_df)
        row = result.iloc[0]
        ebit = sample_raw_df.iloc[0]["EBIT"]
        ie = sample_raw_df.iloc[0]["Interest_Expense"]
        expected = ebit / ie
        assert row["Interest_Coverage"] == pytest.approx(expected, rel=1e-6)

    def test_zero_total_assets_gives_nan(self, sample_raw_df):
        """Zero Total_Assets should produce NaN for ratios."""
        df = sample_raw_df.copy()
        df["Total_Assets"] = 0
        result = build_features_at_t(df)
        assert result["X1"].isna().all()
        assert result["X2"].isna().all()
        assert result["X3"].isna().all()

    def test_zero_interest_expense_gives_nan(self, sample_raw_df):
        """Zero Interest_Expense should produce NaN Interest_Coverage."""
        df = sample_raw_df.copy()
        df["Interest_Expense"] = 0
        result = build_features_at_t(df)
        assert result["Interest_Coverage"].isna().all()

    def test_zero_liabilities_gives_nan_x4(self, sample_raw_df):
        """Zero Total_Liabilities should produce NaN X4."""
        df = sample_raw_df.copy()
        df["Total_Liabilities"] = 0
        result = build_features_at_t(df)
        assert result["X4"].isna().all()

    def test_leverage_repo_fillna(self, sample_raw_df):
        """Leverage_Repo should never be NaN (fillna with default)."""
        result = build_features_at_t(sample_raw_df)
        assert not result["Leverage_Repo"].isna().any()

    def test_does_not_modify_original(self, sample_raw_df):
        """Original df should not be modified."""
        original_cols = list(sample_raw_df.columns)
        build_features_at_t(sample_raw_df)
        assert list(sample_raw_df.columns) == original_cols

    def test_repo_rate_from_rbi(self, sample_raw_df):
        """Repo_Rate should come from RBI_Repo_Rate column."""
        result = build_features_at_t(sample_raw_df)
        pd.testing.assert_series_equal(
            result["Repo_Rate"].reset_index(drop=True),
            sample_raw_df["RBI_Repo_Rate"].reset_index(drop=True),
            check_names=False,
        )


class TestBuildDatasetIntegration:
    """Integration tests using real raw_financials.csv."""

    def test_real_data_feature_engineering(self, raw_financials_path):
        """Build features from the real raw financials file."""
        if not raw_financials_path.exists():
            pytest.skip("raw_financials.csv not available")
        df = pd.read_csv(raw_financials_path)
        # Verify required columns exist
        for col in RAW_COLS:
            assert col in df.columns, f"Missing raw column: {col}"
        result = build_features_at_t(df)
        assert len(result) == len(df)
        assert "X1" in result.columns
        assert "Leverage_Repo" in result.columns
        # Check that most rows have valid features
        valid = result[["X1", "X2", "X3", "X4", "X5"]].notna().all(axis=1).sum()
        assert valid > len(result) * 0.8
