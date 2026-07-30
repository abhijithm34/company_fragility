"""Tests for src/altman.py."""
import numpy as np
import pandas as pd
import pytest

from src.altman import (
    ALTMAN_DISTRESS_THRESHOLD,
    add_altman_z,
    compute_altman_z_row,
    stress_label_from_z,
)


class TestComputeAltmanZRow:
    """Tests for compute_altman_z_row."""

    def test_happy_path(self, sample_raw_row):
        """Known values should produce a finite Z-score."""
        z = compute_altman_z_row(
            current_assets=sample_raw_row["Current_Assets"],
            current_liabilities=sample_raw_row["Current_Liabilities"],
            total_assets=sample_raw_row["Total_Assets"],
            retained_earnings=sample_raw_row["Retained_Earnings"],
            ebit=sample_raw_row["EBIT"],
            market_cap=sample_raw_row["Market_Cap"],
            total_liabilities=sample_raw_row["Total_Liabilities"],
            sales=sample_raw_row["Sales"],
        )
        assert np.isfinite(z)
        assert isinstance(z, float)

    def test_zero_total_assets_returns_nan(self):
        """If total_assets <= 0, should return NaN."""
        z = compute_altman_z_row(
            current_assets=100,
            current_liabilities=50,
            total_assets=0,
            retained_earnings=10,
            ebit=20,
            market_cap=500,
            total_liabilities=100,
            sales=200,
        )
        assert np.isnan(z)

    def test_negative_total_assets_returns_nan(self):
        """Negative total_assets should also return NaN."""
        z = compute_altman_z_row(
            current_assets=100,
            current_liabilities=50,
            total_assets=-100,
            retained_earnings=10,
            ebit=20,
            market_cap=500,
            total_liabilities=100,
            sales=200,
        )
        assert np.isnan(z)

    def test_zero_total_liabilities_gives_nan_x4(self):
        """Zero total_liabilities makes X4 NaN, so Z should be NaN."""
        z = compute_altman_z_row(
            current_assets=100,
            current_liabilities=50,
            total_assets=1000,
            retained_earnings=10,
            ebit=20,
            market_cap=500,
            total_liabilities=0,
            sales=200,
        )
        # X4 = market_cap / 0 -> NaN, so entire Z is NaN
        assert np.isnan(z)

    def test_known_calculation(self):
        """Verify Z-score formula manually."""
        # X1 = (200-100)/1000 = 0.1
        # X2 = 50/1000 = 0.05
        # X3 = 80/1000 = 0.08
        # X4 = 3000/500 = 6.0
        # X5 = 400/1000 = 0.4
        # Z = 1.2*0.1 + 1.4*0.05 + 3.3*0.08 + 0.6*6.0 + 1.0*0.4
        # Z = 0.12 + 0.07 + 0.264 + 3.6 + 0.4 = 4.454
        z = compute_altman_z_row(
            current_assets=200,
            current_liabilities=100,
            total_assets=1000,
            retained_earnings=50,
            ebit=80,
            market_cap=3000,
            total_liabilities=500,
            sales=400,
        )
        assert z == pytest.approx(4.454, rel=1e-3)


class TestStressLabelFromZ:
    """Tests for stress_label_from_z."""

    def test_distressed(self):
        """Z below threshold should return 1."""
        assert stress_label_from_z(1.0) == 1

    def test_not_distressed(self):
        """Z at or above threshold should return 0."""
        assert stress_label_from_z(ALTMAN_DISTRESS_THRESHOLD) == 0
        assert stress_label_from_z(3.0) == 0

    def test_nan_returns_zero(self):
        """NaN Z should return 0 (safe default)."""
        assert stress_label_from_z(np.nan) == 0

    def test_threshold_boundary(self):
        """Just below threshold should be distressed."""
        assert stress_label_from_z(ALTMAN_DISTRESS_THRESHOLD - 0.001) == 1


class TestAddAltmanZ:
    """Tests for add_altman_z DataFrame function."""

    def test_adds_column(self, sample_raw_df):
        """Should add Altman_Z column to the DataFrame."""
        result = add_altman_z(sample_raw_df)
        assert "Altman_Z" in result.columns
        assert len(result) == len(sample_raw_df)

    def test_does_not_modify_original(self, sample_raw_df):
        """Original DataFrame should not be modified."""
        original_cols = list(sample_raw_df.columns)
        add_altman_z(sample_raw_df)
        assert list(sample_raw_df.columns) == original_cols

    def test_integration_real_data(self, raw_financials_path):
        """Integration test with real raw_financials.csv."""
        if not raw_financials_path.exists():
            pytest.skip("raw_financials.csv not available")
        df = pd.read_csv(raw_financials_path)
        result = add_altman_z(df)
        assert "Altman_Z" in result.columns
        # Most rows should have a valid Z-score
        valid_count = result["Altman_Z"].notna().sum()
        assert valid_count > len(result) * 0.5
