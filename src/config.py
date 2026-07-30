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

# Original Altman-style + extensions
BASE_FEATURES: List[str] = [
    "X1", "X2", "X3", "X4", "X5",
    "OCF_TA", "Interest_Coverage", "Debt_Assets", "Repo_Rate", "Leverage_Repo",
]

# Time-series trend features (4-quarter changes)
TREND_FEATURES: List[str] = [
    "EBIT_growth_4q",       # (EBIT_t - EBIT_{t-4}) / abs(EBIT_{t-4})
    "Revenue_growth_4q",    # (Sales_t - Sales_{t-4}) / abs(Sales_{t-4})
    "Debt_change_4q",       # Debt_Assets_t - Debt_Assets_{t-4}
    "IC_trend_4q",          # Interest_Coverage_t - IC_{t-4}
    "OCF_momentum",         # OCF_TA_t - OCF_TA_{t-4}
]

# Bank/financial specific
BANK_FEATURES: List[str] = [
    "Provisions_proxy",     # abs(EBIT - Net_Profit) / Total_Assets (proxy for provisions)
    "CAR_proxy",            # (Total_Assets - Total_Liabilities) / Total_Assets
]

# Market/macro signals
MARKET_FEATURES: List[str] = [
    "MktCap_change_4q",     # (MarketCap_t - MarketCap_{t-4}) / MarketCap_{t-4}
    "Price_to_book",        # Market_Cap / (Total_Assets - Total_Liabilities)
    "Volatility_proxy",     # Std of quarterly EBIT/Assets over trailing 4 quarters
]

FEATURE_COLS: List[str] = BASE_FEATURES + TREND_FEATURES + BANK_FEATURES + MARKET_FEATURES

TARGET_COL: str = "Stress_Label"

