"""Tests for score_csv.py (ensure_features, risk_category)."""
import sys
import unittest.mock
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# score_csv imports shap at module level which may not be installed.
# We mock it to allow importing the functions we actually test.
sys.modules.setdefault("shap", unittest.mock.MagicMock())
# score_csv also imports xgboost indirectly via src.models but we only need
# the scoring utility functions, so we can safely mock xgboost if needed.
sys.modules.setdefault("xgboost", unittest.mock.MagicMock())

from score_csv import (
    DEFAULT_REPO_RATE,
    RAW_COLS,
    RISK_TIERS,
    ensure_features,
    risk_category_from_probability,
)
from src.config import FEATURE_COLS


class TestRiskCategoryFromProbability:
    """Tests for risk_category_from_probability."""

    def test_very_safe(self):
        assert risk_category_from_probability(0.1) == "Very Safe"

    def test_low_risk(self):
        assert risk_category_from_probability(0.3) == "Low Risk"

    def test_moderate_risk(self):
        assert risk_category_from_probability(0.5) == "Moderate Risk"

    def test_high_risk(self):
        assert risk_category_from_probability(0.7) == "High Risk"

    def test_severe_risk(self):
        assert risk_category_from_probability(0.9) == "Severe Risk"

    def test_nan_returns_unknown(self):
        assert risk_category_from_probability(np.nan) == "Unknown"

    def test_zero(self):
        assert risk_category_from_probability(0.0) == "Very Safe"

    def test_boundary_0_2(self):
        """Exactly 0.2 should be Low Risk (not Very Safe)."""
        assert risk_category_from_probability(0.2) == "Low Risk"

    def test_boundary_1_0(self):
        """Probability of 1.0 should still map to Severe Risk."""
        assert risk_category_from_probability(1.0) == "Severe Risk"


class TestEnsureFeatures:
    """Tests for ensure_features."""

    def test_features_already_present(self, sample_feature_df):
        """If all feature columns exist, return unchanged."""
        result = ensure_features(sample_feature_df)
        assert all(c in result.columns for c in FEATURE_COLS)
        assert len(result) == len(sample_feature_df)

    def test_computes_from_raw_columns(self, sample_raw_df):
        """When raw columns are present, features should be engineered."""
        result = ensure_features(sample_raw_df)
        for col in FEATURE_COLS:
            assert col in result.columns

    def test_missing_raw_columns_raises(self):
        """If neither feature cols nor raw cols are present, raise ValueError."""
        df = pd.DataFrame({"Company": ["A"], "Quarter": ["2020-01-01"]})
        with pytest.raises(ValueError, match="Missing"):
            ensure_features(df)

    def test_zero_total_assets_handled(self, sample_raw_df):
        """Zero Total_Assets should produce NaN features (rows dropped)."""
        df = sample_raw_df.copy()
        df["Total_Assets"] = 0
        result = ensure_features(df)
        # All rows should be dropped since features can't be computed
        assert len(result) == 0

    def test_zero_interest_expense(self, sample_raw_df):
        """Zero Interest_Expense should result in NaN Interest_Coverage."""
        df = sample_raw_df.copy()
        df["Interest_Expense"] = 0
        result = ensure_features(df)
        # Rows with NaN Interest_Coverage will be dropped by dropna
        assert len(result) == 0

    def test_preserves_existing_columns(self, sample_raw_df):
        """Original columns should still be present after feature engineering."""
        result = ensure_features(sample_raw_df)
        assert "Company" in result.columns
        assert "Sales" in result.columns
