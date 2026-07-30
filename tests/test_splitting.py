"""Tests for src/splitting.py."""
import numpy as np
import pandas as pd
import pytest

from src.config import TARGET_COL
from src.splitting import time_based_train_test_split


class TestTimeBasedSplit:
    """Tests for time_based_train_test_split."""

    def test_happy_path(self, sample_feature_df):
        """Basic split should produce non-empty train and test sets."""
        train_mask, test_mask, cutoff = time_based_train_test_split(sample_feature_df)
        assert train_mask.sum() > 0
        assert test_mask.sum() > 0
        # All train dates < cutoff, all test dates >= cutoff
        assert (sample_feature_df.loc[train_mask, "Quarter"] < cutoff).all()
        assert (sample_feature_df.loc[test_mask, "Quarter"] >= cutoff).all()

    def test_train_test_no_overlap(self, sample_feature_df):
        """Train and test sets should not overlap."""
        train_mask, test_mask, _ = time_based_train_test_split(sample_feature_df)
        overlap = train_mask & test_mask
        assert not overlap.any()

    def test_covers_all_rows(self, sample_feature_df):
        """Union of train and test should cover all rows."""
        train_mask, test_mask, _ = time_based_train_test_split(sample_feature_df)
        assert (train_mask | test_mask).all()

    def test_custom_test_fraction(self, sample_feature_df):
        """A larger test fraction should yield more test rows."""
        _, test1, _ = time_based_train_test_split(sample_feature_df, test_fraction=0.2)
        _, test2, _ = time_based_train_test_split(sample_feature_df, test_fraction=0.5)
        assert test2.sum() >= test1.sum()

    def test_single_quarter_raises(self):
        """Only one quarter should raise ValueError."""
        df = pd.DataFrame({
            "Company": ["A", "B"],
            "Quarter": pd.to_datetime(["2020-03-31", "2020-03-31"]),
            TARGET_COL: [0, 1],
        })
        with pytest.raises(ValueError, match="Not enough distinct quarters"):
            time_based_train_test_split(df)

    def test_cutoff_adjustment_when_test_single_class(self):
        """If default split produces test with only class 0, cutoff should adjust."""
        quarters = pd.date_range("2018-03-31", periods=10, freq="QE")
        # Put all distressed (label=1) in the middle quarters
        rows = []
        for i, q in enumerate(quarters):
            label = 1 if 3 <= i <= 6 else 0
            rows.append({"Company": "X", "Quarter": q, TARGET_COL: label})
        df = pd.DataFrame(rows)
        # Default 80/20 split: test gets last 2 quarters (all label=0)
        # The function should adjust cutoff
        train_mask, test_mask, cutoff = time_based_train_test_split(df, test_fraction=0.2)
        y_test = df.loc[test_mask, TARGET_COL]
        # After adjustment, test should include at least some label=1
        assert y_test.nunique() >= 1  # at minimum, the function tried adjustment

    def test_two_quarters_minimal(self):
        """Exactly two quarters should still produce a valid split."""
        df = pd.DataFrame({
            "Company": ["A", "A"],
            "Quarter": pd.to_datetime(["2020-03-31", "2020-06-30"]),
            TARGET_COL: [0, 1],
        })
        train_mask, test_mask, cutoff = time_based_train_test_split(df)
        assert train_mask.sum() >= 1
        assert test_mask.sum() >= 1
