## Corporate Fragility Early Warning – XGBoost Project

This repository contains an end-to-end pipeline for building an early warning model for corporate financial distress. The code assumes you have a panel of quarterly financial statements and uses them to engineer ratios, create a future distress label, and train an XGBoost classifier.

### Project structure

- `requirements.txt` – Python dependencies (`numpy`, `pandas`, `scikit-learn`, `xgboost`).
- `raw_financials.csv` – Raw quarterly financial statements at time \(t\).
- `train_fragility_model.py` – Main entry point that runs the full training and evaluation pipeline.
- `scripts/build_dataset_from_raw.py` – Builds `data/processed/feature_dataset_from_raw.csv` from raw financials.
- `data/processed/feature_dataset_from_raw.csv` – Feature dataset generated from the raw statements (created automatically if missing).
- `models/`
  - `fragility_xgb_model.pkl` – Trained XGBoost model (created after training).
  - `fragility_model_features.txt` – Exact feature list used by the model.
- `src/`
  - `__init__.py` – Marks `src` as a package.
  - `config.py` – Central configuration: paths, feature columns, target column.
  - `data_loading.py` – Loads and cleans the feature dataset.
  - `splitting.py` – Time-based train/test split on `Quarter`, with a check that the test set still contains distressed firms.
  - `models.py` – Builds a regularized `XGBClassifier` with class-imbalance handling.
  - `evaluation.py` – Computes metrics and saves evaluation plots.

### Setup

Create and activate a virtual environment (recommended), then install dependencies:

```bash
cd ml_project
pip install -r requirements.txt
```

### Training and evaluation

From the project root, run:

```bash
python train_fragility_model.py
```

This will:

- Build `data/processed/feature_dataset_from_raw.csv` from `raw_financials.csv` if it does not already exist.
- Perform a chronological train/test split using the `Quarter` column, and adjust the cutoff if needed so the test period still has some distressed (`Stress_Label = 1`) firms.
- Train an XGBoost model with conservative hyperparameters and automatic class-imbalance weighting.
- Print to the terminal:
  - Accuracy, ROC-AUC, PR-AUC, precision, recall, F1-score, Brier score, and log loss for train and test.
  - A full classification report and confusion matrix on the test set.
- Save:
  - The trained model to `models/fragility_xgb_model.pkl`.
  - The feature list to `models/fragility_model_features.txt`.
- Compute corporate fragility scores for the latest quarter and print the top companies.
- Save plots under `figures/`:
   - `roc_train.png`, `roc_test.png` – ROC curves.
   - `pr_train.png`, `pr_test.png` – Precision–Recall curves.
   - `pred_vs_actual_train.png`, `pred_vs_actual_test.png` – Predicted probability distributions by class.

### Build dataset from raw financials

- Run `python scripts/build_dataset_from_raw.py` to build a feature dataset from `raw_financials.csv`:
  - Computes Altman Z for each row (`src/altman.py`).
  - Assigns `Stress_Label` based on Z at \(t+4\) (distressed if Z \< 1.8).
  - Builds features at \(t\) (X1–X5, OCF_TA, Interest_Coverage, Debt_Assets, Repo_Rate, Leverage_Repo).
  - Saves the result to `data/processed/feature_dataset_from_raw.csv`.
- Training uses this dataset by default; you do not need any extra flag.

### Time-series CV and tuning

- Time-series cross-validation: `src/validation.py` provides `time_series_cv_splits` and `run_time_series_cv` for expanding-window cross-validation.
- Hyperparameter tuning: `python train_fragility_model.py --tune` runs a small grid over `max_depth`, `n_estimators`, and `learning_rate` with time-series CV and uses the best parameters for the final model.

### Score a new CSV

- `python score_csv.py --input path/to/next_quarter.csv --output path/to/scores.csv`
- The input CSV must have either the engineered feature columns used for training or the raw financial columns with the same schema as `raw_financials.csv`. In the latter case, features are recomputed on the fly.
- The output CSV adds `predicted_probability` and `predicted_label`.

### Extending the project

- You can extend the feature set (for example, growth rates or volatility measures) by modifying `src/config.py` and `scripts/build_dataset_from_raw.py` or `src/data_loading.py`.

