import numpy as np
from xgboost import XGBClassifier


DEFAULT_XGB_PARAMS = {
    "n_estimators": 150,
    "max_depth": 3,
    "learning_rate": 0.08,
    "subsample": 0.7,
    "colsample_bytree": 0.7,
    "min_child_weight": 10,
    "gamma": 1.0,
    "reg_lambda": 5.0,
    "objective": "binary:logistic",
    "eval_metric": "logloss",
    "random_state": 42,
    "n_jobs": -1,
}


def build_xgb_model(
    y_train: np.ndarray,
    param_overrides: dict | None = None,
) -> XGBClassifier:
    """Build a regularized XGBoost model with imbalance handling.

    Hyperparameters are intentionally conservative so that performance is
    strong but not unrealistically perfect. Pass param_overrides to tune.
    """
    unique, counts = np.unique(y_train, return_counts=True)
    class_counts = dict(zip(unique.tolist(), counts.tolist()))
    n_pos = class_counts.get(1, 0)
    n_neg = class_counts.get(0, 0)
    if param_overrides is None:
        print("Training label distribution (0=non-distress, 1=distress):", class_counts)
    if n_pos > 0:
        scale_pos_weight = n_neg / n_pos
    else:
        scale_pos_weight = 1.0
    if param_overrides is None:
        print(f"Using scale_pos_weight={scale_pos_weight:.3f} for XGBoost.")

    params = {**DEFAULT_XGB_PARAMS, "scale_pos_weight": scale_pos_weight}
    if param_overrides:
        params.update(param_overrides)
    return XGBClassifier(**params)

