# Corporate Fragility Early Warning System

A full-stack ML-powered dashboard for predicting corporate financial distress using XGBoost and Altman Z-score methodology. Upload quarterly financial statements, get distress probability scores, SHAP explanations, and visualize risk across companies and time.

![License](https://img.shields.io/badge/license-ISC-blue)
![Python](https://img.shields.io/badge/python-3.10+-brightgreen)
![Node](https://img.shields.io/badge/node-18+-green)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite + TypeScript + Tailwind)                │
│  - Upload & Score CSVs                                          │
│  - Company Risk Profiles with SHAP explanations                 │
│  - Risk Heatmap + Visualizations                                │
│  - Score Run History                                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────────────┐
│  Backend (Express.js + MongoDB)                                  │
│  - File upload + validation                                      │
│  - Spawns Python scoring process                                 │
│  - CRUD for score runs                                           │
│  - Company analytics aggregation                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ subprocess
┌──────────────────────────▼──────────────────────────────────────┐
│  ML Pipeline (Python + XGBoost + SHAP)                           │
│  - Feature engineering from raw financials                       │
│  - Altman Z-score based distress labeling                        │
│  - XGBoost classifier with class imbalance handling              │
│  - SHAP values for model explainability                          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- **Python 3.10+** with pip
- **Node.js 18+** with npm
- **MongoDB** (local or cloud - [MongoDB Atlas](https://www.mongodb.com/atlas) free tier works)

### 1. Clone and Install

```bash
git clone https://github.com/abhijithm34/company_fragility.git
cd company_fragility

# Install Python dependencies
pip install -r requirements.txt

# Install all Node.js dependencies
npm run install:all
```

### 2. Configure Environment

```bash
# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your MongoDB URI

# Frontend environment (optional - defaults to localhost:5000)
cp frontend/.env.example frontend/.env
```

### 3. Train the Model (first time only)

```bash
python train_fragility_model.py
```

This builds the feature dataset from `raw_financials.csv`, trains the XGBoost model, and saves it to `models/`.

### 4. Run the Application

```bash
# Start both frontend and backend (requires concurrently)
npm run dev

# Or start separately:
npm run dev:backend    # Express API on port 5000
npm run dev:frontend   # Vite dev server on port 5173
```

Open http://localhost:5173 in your browser.

## Project Structure

```
company_fragility/
├── src/                        # Python ML pipeline modules
│   ├── config.py               # Paths, feature columns, constants
│   ├── data_loading.py         # Load and clean feature dataset
│   ├── splitting.py            # Time-based train/test split
│   ├── models.py               # XGBoost model builder
│   ├── evaluation.py           # Metrics, plots, confusion matrix
│   ├── altman.py               # Altman Z-score computation
│   └── validation.py           # Time-series cross-validation
├── scripts/
│   └── build_dataset_from_raw.py   # Raw financials → feature dataset (RFDS labeling)
├── backend/                    # Express.js API
│   ├── src/
│   │   ├── server.js           # App setup, middleware, startup
│   │   ├── routes/scoreRuns.js # Upload, score, CRUD endpoints
│   │   ├── routes/companies.js # Company analytics + heatmap
│   │   └── models/ScoreRun.js  # Mongoose schema
│   ├── __tests__/              # Jest test suite
├── frontend/                   # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/              # Route pages (Upload, History, etc.)
│   │   ├── components/         # Shared UI components
│   │   ├── config/api.ts       # Centralized API configuration
│   │   └── context/            # React context (filters)
├── tests/                      # Python pytest suite
├── models/                     # Trained model artifacts
├── raw_financials.csv          # Input data (30 Indian companies)
├── train_fragility_model.py    # Full training pipeline
├── score_csv.py                # Score new data with trained model
├── requirements.txt            # Pinned Python dependencies
└── package.json                # Root workspace scripts
```

## ML Pipeline

### Features (Altman Z-style + extensions)

| Feature | Description |
|---------|-------------|
| X1 | Working Capital / Total Assets |
| X2 | Retained Earnings / Total Assets |
| X3 | EBIT / Total Assets |
| X4 | Market Cap / Total Liabilities |
| X5 | Sales / Total Assets |
| OCF_TA | Operating Cash Flow / Total Assets |
| Interest_Coverage | EBIT / Interest Expense |
| Debt_Assets | Total Debt / Total Assets |
| Repo_Rate | RBI Repo Rate (macro indicator) |
| Leverage_Repo | Debt_Assets × (Repo_Rate / 10) |

### Labeling Strategy — Relative Financial Deterioration Score (RFDS)

Labels are **not** based on a fixed Altman Z threshold. Absolute thresholds are
sector-biased (banks structurally run low coverage; IT firms run very high), so
instead the target is built with a **self-referential, forward-looking** rule in
`scripts/build_dataset_from_raw.py`:

- For each company at quarter `t`, look **4 quarters ahead** (`t+4`) and compare
  against that same company's **trailing 4-quarter average** at `t`.
- Count how many of these **5 deterioration signals** fire at `t+4`:
  1. **Profitability erosion** — EBIT/Assets falls below ~50% of its own baseline
  2. **Cash-flow stress** — OCF/Assets falls below ~40% of its own baseline
  3. **Leverage spike** — Debt/Assets rises above ~125% of its own baseline
  4. **Coverage crisis** — Interest Coverage drops below ~40% of baseline (or below 1.0 absolute)
  5. **Market signal** — Market Cap/Assets falls below ~50% of its own baseline
- If **2 or more signals** fire simultaneously → `Stress_Label = 1` (distressed).

Because the baseline is each company's own history, the rule works across any
sector and produces realistic probability spreads (healthy ≈ 5–15%, moderate ≈
20–50%, high/severe ≈ 60–95%) rather than artificial 0%/100% outputs. The
Altman Z-score itself (`src/altman.py`) is used to derive the X1–X5 ratio
features, not as the training label.

### Training

```bash
# Standard training
python train_fragility_model.py

# With hyperparameter tuning via time-series CV
python train_fragility_model.py --tune
```

### Scoring New Data

```bash
python score_csv.py --input path/to/new_data.csv --output path/to/scores.csv
```

The input CSV can contain either:
- **Raw financials** (Company, Quarter, Sales, Total_Assets, etc.) — features computed automatically
- **Pre-computed features** (X1-X5, OCF_TA, etc.) — used directly

Output includes: `predicted_probability`, `predicted_label`, `risk_category`, and SHAP values per feature.

### Risk Categories

| Probability | Category |
|-------------|----------|
| 0.0 – 0.2 | Very Safe |
| 0.2 – 0.4 | Low Risk |
| 0.4 – 0.6 | Moderate Risk |
| 0.6 – 0.8 | High Risk |
| 0.8 – 1.0 | Severe Risk |

## Testing

```bash
# Python tests (58 tests)
pytest tests/ -v --cov=src

# Backend tests (11 tests)
cd backend && npm test

# Frontend lint
cd frontend && npm run lint
```

## Deployment

The backend and frontend can be hosted on any Node-capable environment.

### Backend

The backend requires **both Node.js and Python** on the host, because the
Express API spawns `score_csv.py` as a subprocess at runtime. Run it from the
project root so the Python ML pipeline (`src/`, `models/`, `score_csv.py`) is
reachable:

```bash
cd backend && npm install && npm start
```

Required environment variables: `MONGODB_URI` (MongoDB connection string),
`CORS_ORIGINS` (comma-separated allowed frontend origins), `NODE_ENV`
(`production`), and `PYTHON` (`python3`).

### Frontend

Build the static bundle and serve it from any static host:

```bash
cd frontend && npm run build   # outputs to frontend/dist
```

Set `VITE_API_BASE_URL` to your deployed backend URL before building.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/score-runs` | Upload CSV and start scoring |
| GET | `/api/score-runs` | List all runs (paginated) |
| GET | `/api/score-runs/:id` | Get run details |
| GET | `/api/score-runs/:id/rows` | Get scored rows (paginated) |
| GET | `/api/score-runs/:id/download` | Download scored CSV |
| GET | `/api/companies/:name` | Company risk profile + SHAP |
| GET | `/api/heatmap` | Risk heatmap data |
| GET | `/api/model-metadata` | Model info |

## Data

The repository ships with `raw_financials.csv` — quarterly financial data for 30 major Indian companies from 2014 to 2025, including companies showing genuine financial distress patterns. Training runs on this file by default via `build_dataset_from_raw.py` (RFDS labeling + feature engineering).

To train on your own data, replace `raw_financials.csv` with a CSV that has the same raw financial columns (Company, Quarter, Sales, Total_Assets, Total_Liabilities, Short_Term_Debt, Long_Term_Debt, EBIT, Interest_Expense, Operating_Cash_Flow, Market_Cap, Retained_Earnings, Current_Assets, Current_Liabilities, RBI_Repo_Rate), then re-run training:

```bash
python train_fragility_model.py
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/improvement`)
3. Run tests before committing (`pytest tests/ -v && cd backend && npm test`)
4. Commit changes (`git commit -am 'Add feature'`)
5. Push and open a Pull Request

## License

ISC
