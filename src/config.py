from pathlib import Path
from typing import List


PROJECT_ROOT = Path(__file__).resolve().parent.parent

RAW_FINANCIALS_FILE: Path = PROJECT_ROOT / "raw_financials.csv"
# Dataset built from raw financials (generated automatically by train script)
DATA_PROCESSED_DIR: Path = PROJECT_ROOT / "data" / "processed"
FEATURE_DATA_FROM_RAW_FILE: Path = DATA_PROCESSED_DIR / "feature_dataset_from_raw.csv"

# Where to save trained models and metadata
MODELS_DIR: Path = PROJECT_ROOT / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

MODEL_FILE: Path = MODELS_DIR / "fragility_xgb_model.pkl"
FEATURES_FILE: Path = MODELS_DIR / "fragility_model_features.txt"

# Where to save evaluation figures (ROC, PR, predicted vs actual, etc.)
FIGURES_DIR: Path = PROJECT_ROOT / "figures"
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

ID_COLS: List[str] = ["Company", "Quarter"]

FEATURE_COLS: List[str] = [
    "X1",
    "X2",
    "X3",
    "X4",
    "X5",
    "OCF_TA",
    "Interest_Coverage",
    "Debt_Assets",
    "Repo_Rate",
    "Leverage_Repo",
]

TARGET_COL: str = "Stress_Label"

