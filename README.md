## Corporate Fragility Early Warning – XGBoost Project

This project implements an end-to-end **early warning system for corporate financial distress** using your synthetic panel dataset:

- Raw quarterly financials at time \(t\) (`synthetic_raw_financials.csv`).
- The pipeline automatically generates a feature dataset and a future distress label at \(t+4\) (`Stress_Label`), based on Altman Z-score `< 1.8` (Altman is used only to create labels, not as a model input).

The model is an **XGBoost classifier** with explicit handling of **class imbalance** and **time-based splits**, designed to behave more like a real-world dataset (accuracy in the ~85–95% range, not perfect).

### Project structure

- `requirements.txt` – Python dependencies (`numpy`, `pandas`, `scikit-learn`, `xgboost`).
- `synthetic_raw_financials.csv` – Synthetic raw financial statements (source of truth).
- `train_fragility_model.py` – Main entry point that wires the whole pipeline together.
- `scripts/build_dataset_from_raw.py` – Builds `data/processed/feature_dataset_from_raw.csv` from raw financials.
- `data/processed/feature_dataset_from_raw.csv` – Generated feature dataset (created automatically if missing).
- `models/`
  - `fragility_xgb_model.pkl` – Trained XGBoost model (created after training).
  - `fragility_model_features.txt` – Exact feature list used by the model.
- `src/`
  - `__init__.py` – Marks `src` as a package.
  - `config.py` – Central configuration: paths, feature columns, target column.
  - `data_loading.py` – Loads and cleans `synthetic_feature_dataset.csv`.
  - `splitting.py` – Time-based train/test split on `Quarter`, adjusted so the **test set always includes distressed samples**.
  - `models.py` – Builds a regularized `XGBClassifier` with `scale_pos_weight` to handle imbalance.
  - `evaluation.py` – Computes metrics (ROC-AUC, PR-AUC, accuracy, classification report, confusion matrix) **and saves graphs**.

### Setup

Create and activate a virtual environment (recommended), then install dependencies:

```bash
cd ml_project
pip install -r requirements.txt
```

### Training and evaluation

Run the full training + evaluation + scoring pipeline from the project root:

```bash
python train_fragility_model.py
```

This will:

- Build `data/processed/feature_dataset_from_raw.csv` automatically (if missing), then load it.
- Perform a **chronological train/test split** using the `Quarter` column, then adjust the cutoff if needed so the test period still contains some distressed (`Stress_Label = 1`) firms.
- Train an **XGBoost** model with conservative hyperparameters and automatic class imbalance weighting.
- Print to terminal (all metrics):
  - **Accuracy**, **ROC-AUC**, **PR-AUC**, **Precision**, **Recall**, **F1-score**, **Brier score**, **Log loss** for train and test.
  - Full test **classification report** and **confusion matrix**.
- Save:
  - The trained model to `models/fragility_xgb_model.pkl`.
  - The feature list to `models/fragility_model_features.txt`.
- Compute **Corporate Fragility Scores** for the **latest quarter** and print the top 10 to terminal.
- Save graphs under `figures/`:
   - `roc_train.png`, `roc_test.png` – ROC curves (predicted vs actual classification quality).
   - `pr_train.png`, `pr_test.png` – Precision–Recall curves.
   - `pred_vs_actual_train.png`, `pred_vs_actual_test.png` – Distributions of predicted probabilities separated by actual class (visual “predicted vs actual” comparison).

### Build dataset from raw financials (4.1)

- Run `python scripts/build_dataset_from_raw.py` to build a feature dataset from `synthetic_raw_financials.csv`:
  - Computes **Altman Z** for each row (`src/altman.py`).
  - Assigns **Stress_Label** from Z at \(t+4\) (distressed if Z \< 1.8).
  - Builds features at \(t\) (X1–X5, OCF_TA, Interest_Coverage, Debt_Assets, Repo_Rate, Leverage_Repo).
  - Saves to `data/processed/feature_dataset_from_raw.csv`.
- Training uses this dataset by default; you do not need any extra flag.

### Time-series CV, tuning, and calibration (4.3)

- **Time-series CV**: `src/validation.py` provides `time_series_cv_splits` and `run_time_series_cv` for expanding-window cross-validation.
- **Hyperparameter tuning**: `python train_fragility_model.py --tune` runs a small grid over `max_depth`, `n_estimators`, `learning_rate` with time-series CV and uses the best params for the final model.
- **Probability calibration**: `python train_fragility_model.py --calibrate` fits Platt (sigmoid) scaling on a train holdout and saves the calibrated model.

### Score a new CSV (4.4)

- `python score_csv.py --input path/to/next_quarter.csv --output path/to/scores.csv`
- Input CSV must have the same feature columns as training (and optionally Company, Quarter).
- Output CSV adds `predicted_probability` and `predicted_label`.

### Extending the project

- Add new features (growth rates, volatility, trends) by extending `src/config.py` and `scripts/build_dataset_from_raw.py` or `src/data_loading.py`.


