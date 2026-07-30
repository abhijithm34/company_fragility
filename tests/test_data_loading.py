"""Tests for src/data_loading.py."""
import numpy as np
import pandas as pd
import pytest

from src.config import FEATURE_COLS, ID_COLS, TARGET_COL
from src.data_loading import load_feature_dataset


class TestLoadFeatureDataset:
    """Tests for the load_feature_dataset function."""

    def test_happy_path(self, tmp_csv):
        """Loading a valid feature CSV should return a clean DataFrame."""
        df = load_feature_dataset(tmp_csv)
        assert not df.empty
        assert TARGET_COL in df.columns
        assert df[TARGET_COL].dtype in (int, np.int64, np.int32)
        # Quarter should be datetime
        assert pd.api.types.is_datetime64_any_dtype(df["Quarter"])

    def test_missing_columns_raises(self, tmp_path):
        """Loading a CSV with missing feature columns should raise ValueError."""
        df = pd.DataFrame({"Company": ["A"], "Quarter": ["2020-01-01"]})
        p = tmp_path / "bad.csv"
        df.to_csv(p, index=False)
        with pytest.raises(ValueError, match="Missing expected columns"):
            load_feature_dataset(p)

    def test_drops_na_target(self, tmp_path, sample_feature_df):
        """Rows with NaN target should be dropped."""
        df = sample_feature_df.copy()
        df.loc[0, TARGET_COL] = np.nan
        p = tmp_path / "with_nan.csv"
        df.to_csv(p, index=False)
        result = load_feature_dataset(p)
        assert not result[TARGET_COL].isna().any()

    def test_drops_na_features(self, tmp_path, sample_feature_df):
        """Rows with NaN in any feature column should be dropped."""
        df = sample_feature_df.copy()
        df.loc[0, FEATURE_COLS[0]] = np.nan
        p = tmp_path / "with_nan_feat.csv"
        df.to_csv(p, index=False)
        result = load_feature_dataset(p)
        assert not result[FEATURE_COLS].isna().any().any()

    def test_sorted_by_id_cols(self, tmp_csv):
        """Result should be sorted by ID_COLS."""
        df = load_feature_dataset(tmp_csv)
        expected = df.sort_values(ID_COLS).reset_index(drop=True)
        pd.testing.assert_frame_equal(df, expected)

    def test_integration_with_real_data(self, raw_financials_path, project_root):
        """Integration test: load the real processed feature dataset if available."""
        processed = project_root / "data" / "processed" / "feature_dataset_from_raw.csv"
        if not processed.exists():
            pytest.skip("Processed feature dataset not available")
        df = load_feature_dataset(processed)
        assert len(df) > 0
        assert all(c in df.columns for c in FEATURE_COLS)
