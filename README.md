## Corporate Fragility Early Warning – XGBoost Project

This project implements an end-to-end **early warning system for corporate financial distress** using your synthetic panel dataset:

- Present-time company + macro features at quarter \(t\) (`synthetic_feature_dataset.csv`).
- Future distress label at \(t+4\) (`Stress_Label`), based on Altman Z-score `< 1.8` (Altman is used only to create labels, not as a model input).

The model is an **XGBoost classifier** with explicit handling of **class imbalance** and **time-based splits**, designed to behave more like a real-world dataset (accuracy in the ~85–95% range, not perfect).

### Project structure

- `requirements.txt` – Python dependencies (`numpy`, `pandas`, `scikit-learn`, `xgboost`).
- `synthetic_feature_dataset.csv` – Engineered feature dataset (inputs X1–X5, ratios, macro features, and `Stress_Label`).
- `synthetic_raw_financials.csv` – Synthetic raw financial statements (optional, for future Altman/feature work).
- `train_fragility_model.py` – Main entry point that wires the whole pipeline together.
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

- Load `synthetic_feature_dataset.csv`.
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

### Extending the project

- Use `synthetic_raw_financials.csv` to recompute Altman Z-scores at \(t+4\) and regenerate labels.
- Add new features (growth rates, volatility, trends, sector dummies) by extending `src/config.py` and `src/data_loading.py`.
- Create a separate inference script that loads `models/fragility_xgb_model.pkl` and scores new quarterly feature files.


