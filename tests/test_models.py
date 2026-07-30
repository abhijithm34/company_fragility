"""Tests for src/models.py."""
import sys
import unittest.mock

import numpy as np
import pytest

# XGBoost native library (libomp) may not be available in the test environment.
# Mock it if import fails so we can still test the logic in models.py.
try:
    import xgboost
    from xgboost import XGBClassifier
    HAS_XGBOOST = True
except (ImportError, Exception):
    # Create a minimal mock for XGBClassifier
    HAS_XGBOOST = False
    # We need to mock the entire xgboost module before importing src.models
    mock_xgb = unittest.mock.MagicMock()

    class _MockXGBClassifier:
        """A lightweight mock that stores params like the real XGBClassifier."""
        def __init__(self, **kwargs):
            self._params = kwargs

        def get_params(self, deep=True):
            return self._params.copy()

        def fit(self, X, y, **kwargs):
            self._classes = np.unique(y)
            return self

        def predict(self, X):
            return np.zeros(len(X), dtype=int)

    mock_xgb.XGBClassifier = _MockXGBClassifier
    sys.modules["xgboost"] = mock_xgb
    XGBClassifier = _MockXGBClassifier

from src.models import DEFAULT_XGB_PARAMS, build_xgb_model


class TestBuildXgbModel:
    """Tests for build_xgb_model."""

    def test_returns_xgb_classifier(self):
        """Should return an XGBClassifier instance."""
        y = np.array([0, 0, 0, 1, 1])
        model = build_xgb_model(y)
        assert isinstance(model, XGBClassifier)

    def test_scale_pos_weight_balanced(self):
        """With equal classes, scale_pos_weight should be ~1.0."""
        y = np.array([0, 0, 1, 1])
        model = build_xgb_model(y, param_overrides={})
        assert model.get_params()["scale_pos_weight"] == pytest.approx(1.0)

    def test_scale_pos_weight_imbalanced(self):
        """With imbalanced classes, scale_pos_weight should reflect ratio."""
        y = np.array([0] * 90 + [1] * 10)
        model = build_xgb_model(y, param_overrides={})
        # Expected: 90/10 = 9.0
        assert model.get_params()["scale_pos_weight"] == pytest.approx(9.0)

    def test_no_positive_samples(self):
        """With no positive samples, scale_pos_weight should be 1.0."""
        y = np.array([0, 0, 0, 0])
        model = build_xgb_model(y, param_overrides={})
        assert model.get_params()["scale_pos_weight"] == pytest.approx(1.0)

    def test_param_overrides(self):
        """Custom param overrides should be reflected in the model."""
        y = np.array([0, 0, 1, 1])
        model = build_xgb_model(y, param_overrides={"max_depth": 7, "n_estimators": 50})
        assert model.get_params()["max_depth"] == 7
        assert model.get_params()["n_estimators"] == 50

    def test_default_params_present(self):
        """Default XGB params should be used when no overrides given."""
        y = np.array([0, 1])
        model = build_xgb_model(y, param_overrides={})
        params = model.get_params()
        assert params["max_depth"] == DEFAULT_XGB_PARAMS["max_depth"]
        assert params["learning_rate"] == DEFAULT_XGB_PARAMS["learning_rate"]

    @pytest.mark.skipif(not HAS_XGBOOST, reason="xgboost native library not available")
    def test_model_can_fit(self):
        """Model should be trainable on simple data without error."""
        np.random.seed(42)
        y = np.array([0] * 50 + [1] * 50)
        X = np.random.randn(100, 5)
        model = build_xgb_model(y, param_overrides={})
        model.fit(X, y)
        preds = model.predict(X)
        assert len(preds) == 100
        assert set(preds).issubset({0, 1})
