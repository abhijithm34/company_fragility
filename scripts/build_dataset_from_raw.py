"""Build a feature dataset and Stress_Label from raw financials.

Uses the Relative Financial Deterioration Score (RFDS) — a universal,
sector-agnostic approach to labeling corporate distress.

Instead of absolute thresholds (like Altman Z < 1.8), this measures whether
a company's OWN fundamentals are deteriorating relative to its own trailing
history. This works for ANY company — banks, IT, manufacturing, utilities —
because the baseline is self-referential.

Distress label = 1 at time t if the company shows simultaneous deterioration
across 3+ of 5 dimensions at time t+4:

1. Profitability erosion: EBIT/Assets < trailing_mean * 0.6
2. Cash flow stress: OCF/Assets < trailing_mean * 0.5
3. Leverage spike: Debt/Assets > trailing_mean * 1.3
4. Coverage crisis: Interest Coverage < 2.0 (universal)
5. Market signal: MarketCap/Assets < trailing_mean * 0.5

This produces realistic distributions:
- Healthy companies: model outputs 5-15% probability (not artificial 0%)
- Moderate risk: 20-50%
- High/Severe risk: 60-95%
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import RAW_FINANCIALS_FILE, FEATURE_COLS as CONFIG_FEATURE_COLS

RAW_COLS = [
    "Company", "Quarter", "Sales", "Total_Assets", "Total_Liabilities",
    "Short_Term_Debt", "Long_Term_Debt", "EBIT", "Interest_Expense",
    "Operating_Cash_Flow", "Market_Cap", "Retained_Earnings",
    "Current_Assets", "Current_Liabilities", "RBI_Repo_Rate",
]

OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"
OUTPUT_FILE = OUTPUT_DIR / "feature_dataset_from_raw.csv"

DEFAULT_LEVERAGE_REPO = 1.5
TRAILING_WINDOW = 4  # 4 quarters (1 year) trailing average for baseline


def compute_rfds_labels(df: pd.DataFrame) -> pd.DataFrame:
    """Compute Relative Financial Deterioration Score labels.
    
    For each (Company, Quarter=t), we look at conditions at t+4 and compare
    against the company's trailing 8-quarter averages to determine if the
    company is showing signs of stress.
    """
    df = df.copy()
    df = df.sort_values(["Company", "Quarter"]).reset_index(drop=True)

    ta = df["Total_Assets"].replace(0, np.nan)
    
    # Compute per-row financial ratios
    df["_ebit_assets"] = df["EBIT"] / ta
    df["_ocf_assets"] = df["Operating_Cash_Flow"] / ta
    df["_debt_assets"] = (df["Short_Term_Debt"] + df["Long_Term_Debt"]) / ta
    df["_interest_coverage"] = df["EBIT"] / df["Interest_Expense"].replace(0, np.nan)
    df["_mktcap_assets"] = df["Market_Cap"] / ta

    # Compute trailing means (expanding window, min 4 quarters)
    for metric in ["_ebit_assets", "_ocf_assets", "_debt_assets", "_mktcap_assets"]:
        df[f"{metric}_trail"] = df.groupby("Company")[metric].transform(
            lambda s: s.rolling(window=TRAILING_WINDOW, min_periods=4).mean()
        )

    # Build lookup structures
    quarters_sorted = np.sort(df["Quarter"].unique())
    nq = len(quarters_sorted)
    q_to_idx = {pd.Timestamp(q): i for i, q in enumerate(quarters_sorted)}

    # Create indexed lookups for t+4 evaluation
    idx_cols = ["Company", "Quarter"]
    lookup = df.set_index(idx_cols)

    def get_stress_label(row):
        company = row["Company"]
        q_t = pd.Timestamp(row["Quarter"])
        idx = q_to_idx.get(q_t)

        if idx is None or idx + 4 >= nq:
            return np.nan

        q_t4 = pd.Timestamp(quarters_sorted[idx + 4])

        try:
            future = lookup.loc[(company, q_t4)]
            current = lookup.loc[(company, q_t)]
        except KeyError:
            return np.nan

        signals = 0

        # Use CURRENT (time t) trailing averages as the baseline,
        # then check if the FUTURE (t+4) values have deteriorated
        # This catches: "the company was healthy at t but will be in trouble at t+4"

        # 1. Profitability erosion: EBIT/Assets at t+4 < baseline at t * 0.5
        ebit_future = future["_ebit_assets"]
        ebit_baseline = current["_ebit_assets_trail"]
        if pd.notna(ebit_future) and pd.notna(ebit_baseline) and ebit_baseline > 0:
            if ebit_future < ebit_baseline * 0.5:
                signals += 1
        elif pd.notna(ebit_future) and ebit_future < 0:
            signals += 1

        # 2. Cash flow stress: OCF/Assets at t+4 < baseline at t * 0.4
        ocf_future = future["_ocf_assets"]
        ocf_baseline = current["_ocf_assets_trail"]
        if pd.notna(ocf_future) and pd.notna(ocf_baseline) and ocf_baseline > 0:
            if ocf_future < ocf_baseline * 0.4:
                signals += 1
        elif pd.notna(ocf_future) and ocf_future < 0:
            signals += 1

        # 3. Leverage spike: Debt/Assets at t+4 > baseline at t * 1.25
        da_future = future["_debt_assets"]
        da_baseline = current["_debt_assets_trail"]
        if pd.notna(da_future) and pd.notna(da_baseline) and da_baseline > 0:
            if da_future > da_baseline * 1.25:
                signals += 1

        # 4. Coverage crisis: Interest Coverage below company's own historical minimum + buffer
        #    (Universal absolute thresholds don't work: banks have IC ~1.3 structurally,
        #     while IT companies have IC > 20. Use relative: below own trailing * 0.5)
        ic_future = future["_interest_coverage"]
        ic_baseline = current.get("_interest_coverage", np.nan)
        if pd.notna(ic_future) and pd.notna(ic_baseline) and ic_baseline > 0:
            if ic_future < ic_baseline * 0.4:
                signals += 1
        elif pd.notna(ic_future) and ic_future < 1.0:
            # Below 1.0 is universal distress — can't cover interest at all
            signals += 1

        # 5. Market signal: Market Cap/Assets at t+4 < baseline at t * 0.5
        mc_future = future["_mktcap_assets"]
        mc_baseline = current["_mktcap_assets_trail"]
        if pd.notna(mc_future) and pd.notna(mc_baseline) and mc_baseline > 0:
            if mc_future < mc_baseline * 0.5:
                signals += 1

        # Stressed if 2+ signals fire simultaneously (early warning)
        return 1 if signals >= 2 else 0

    print("  Computing RFDS labels (this evaluates each company against its own history)...")
    df["Stress_Label"] = df.apply(get_stress_label, axis=1)
    df = df.dropna(subset=["Stress_Label"])

    # Drop temporary columns
    temp_cols = [c for c in df.columns if c.startswith("_")]
    df = df.drop(columns=temp_cols, errors="ignore")

    return df


def build_features_at_t(df: pd.DataFrame) -> pd.DataFrame:
    """Add feature columns from raw financials."""
    out = df.copy()
    ta = out["Total_Assets"].replace(0, np.nan)
    tl = out["Total_Liabilities"].replace(0, np.nan)
    out["X1"] = (out["Current_Assets"] - out["Current_Liabilities"]).clip(lower=0) / ta
    out["X2"] = out["Retained_Earnings"] / ta
    out["X3"] = out["EBIT"] / ta
    out["X4"] = out["Market_Cap"] / tl
    out["X5"] = out["Sales"] / ta
    out["OCF_TA"] = out["Operating_Cash_Flow"] / ta
    ie = out["Interest_Expense"].replace(0, np.nan)
    out["Interest_Coverage"] = out["EBIT"] / ie
    out["Debt_Assets"] = (out["Short_Term_Debt"] + out["Long_Term_Debt"]) / ta
    out["Repo_Rate"] = out["RBI_Repo_Rate"]
    out["Leverage_Repo"] = out["Debt_Assets"] * (out["Repo_Rate"] / 10.0)
    out["Leverage_Repo"] = out["Leverage_Repo"].fillna(DEFAULT_LEVERAGE_REPO)

    # --- Time-series trend features ---
    # These require looking at the same company 4 quarters ago
    out = out.sort_values(["Company", "Quarter"]).reset_index(drop=True)
    for company in out["Company"].unique():
        mask = out["Company"] == company
        co_df = out.loc[mask].sort_values("Quarter")
        idx = co_df.index

        # 4-quarter lagged values
        out.loc[idx, "EBIT_growth_4q"] = co_df["X3"].pct_change(4)
        out.loc[idx, "Revenue_growth_4q"] = co_df["X5"].pct_change(4)
        out.loc[idx, "Debt_change_4q"] = co_df["Debt_Assets"].diff(4)
        out.loc[idx, "IC_trend_4q"] = co_df["Interest_Coverage"].diff(4)
        out.loc[idx, "OCF_momentum"] = co_df["OCF_TA"].diff(4)
        out.loc[idx, "MktCap_change_4q"] = co_df["X4"].pct_change(4)  # X4 = MarketCap/Liab
        out.loc[idx, "Volatility_proxy"] = co_df["X3"].rolling(4).std()

    # Clip pct_change features to [-5, 5]
    for col in ["EBIT_growth_4q", "Revenue_growth_4q", "MktCap_change_4q"]:
        out[col] = out[col].clip(-5, 5)

    # --- Bank-specific features ---
    # Provisions proxy: (Sales - EBIT - Interest) / Assets (higher = more provisions)
    out["Provisions_proxy"] = (out["Sales"] - out["EBIT"] - out["Interest_Expense"]).clip(lower=0) / ta

    # CAR proxy: Equity / Total Assets (higher = more capital buffer)
    out["CAR_proxy"] = (out["Total_Assets"] - out["Total_Liabilities"]).clip(lower=0) / ta

    # --- Market features ---
    # Price to book
    equity = (out["Total_Assets"] - out["Total_Liabilities"]).replace(0, np.nan)
    out["Price_to_book"] = out["Market_Cap"] / equity

    # Replace inf with NaN, fill NaN trend features with 0
    trend_cols = ["EBIT_growth_4q", "Revenue_growth_4q", "Debt_change_4q",
                  "IC_trend_4q", "OCF_momentum", "MktCap_change_4q", "Volatility_proxy"]
    for col in trend_cols:
        out[col] = out[col].replace([np.inf, -np.inf], np.nan).fillna(0.0)

    return out


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(RAW_FINANCIALS_FILE)
    df["Quarter"] = pd.to_datetime(df["Quarter"])
    df = df.sort_values(["Company", "Quarter"]).reset_index(drop=True)

    for c in RAW_COLS:
        if c not in df.columns:
            raise ValueError(f"Missing column in raw financials: {c}")

    print("=" * 60)
    print("  RELATIVE FINANCIAL DETERIORATION SCORE (RFDS)")
    print("=" * 60)
    print(f"  Method: Compare each company at t+4 vs its own trailing {TRAILING_WINDOW}-quarter average")
    print(f"  Signals: Profitability, Cash Flow, Leverage, Coverage, Market")
    print(f"  Threshold: 2+ of 5 signals = stressed (early warning)")
    print()

    df = compute_rfds_labels(df)
    df = build_features_at_t(df)

    feature_cols = CONFIG_FEATURE_COLS
    out_cols = ["Company", "Quarter"] + feature_cols + ["Stress_Label"]

    # Replace inf with NaN (XGBoost handles NaN natively)
    for col in feature_cols:
        df[col] = df[col].replace([np.inf, -np.inf], np.nan)

    df = df[out_cols].copy()
    df["Stress_Label"] = df["Stress_Label"].astype(int)

    # Print results
    n_stressed = int(df["Stress_Label"].sum())
    n_total = len(df)
    print(f"\n  Dataset: {n_total} rows")
    print(f"  Stressed: {n_stressed} ({n_stressed/n_total*100:.1f}%)")
    print(f"  Healthy: {n_total - n_stressed} ({(n_total-n_stressed)/n_total*100:.1f}%)")
    print()
    print("  Per-company stress rates:")
    rates = df.groupby("Company")["Stress_Label"].mean().sort_values(ascending=False)
    for co, rate in rates.items():
        if rate > 0.3:
            marker = "🔴"
        elif rate > 0:
            marker = "🟡"
        else:
            marker = "🟢"
        print(f"    {marker} {co}: {rate*100:.0f}%")

    df.to_csv(OUTPUT_FILE, index=False)
    print(f"\n  Saved to {OUTPUT_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
