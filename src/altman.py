"""Altman Z-score computations for corporate financial distress."""
import numpy as np
import pandas as pd


# Altman Z threshold: below this = distressed
ALTMAN_DISTRESS_THRESHOLD = 1.8


def compute_altman_z_row(
    *,
    current_assets: float,
    current_liabilities: float,
    total_assets: float,
    retained_earnings: float,
    ebit: float,
    market_cap: float,
    total_liabilities: float,
    sales: float,
) -> float:
    """Compute Altman Z for a single row. Returns np.nan if denominators are zero."""
    if total_assets <= 0:
        return np.nan
    wc = current_assets - current_liabilities
    x1 = wc / total_assets
    x2 = retained_earnings / total_assets
    x3 = ebit / total_assets
    x4 = (market_cap / total_liabilities) if total_liabilities > 0 else np.nan
    x5 = sales / total_assets
    z = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5
    return float(z)


def add_altman_z(df: pd.DataFrame) -> pd.DataFrame:
    """Add column 'Altman_Z' to a DataFrame with raw financial columns.

    Expects columns: Current_Assets, Current_Liabilities, Total_Assets,
    Retained_Earnings, EBIT, Market_Cap, Total_Liabilities, Sales.
    """
    out = df.copy()
    out["Altman_Z"] = out.apply(
        lambda r: compute_altman_z_row(
            current_assets=r["Current_Assets"],
            current_liabilities=r["Current_Liabilities"],
            total_assets=r["Total_Assets"],
            retained_earnings=r["Retained_Earnings"],
            ebit=r["EBIT"],
            market_cap=r["Market_Cap"],
            total_liabilities=r["Total_Liabilities"],
            sales=r["Sales"],
        ),
        axis=1,
    )
    return out


def stress_label_from_z(z: float) -> int:
    """Return 1 if Z < threshold (distressed), else 0."""
    if np.isnan(z):
        return 0
    return 1 if z < ALTMAN_DISTRESS_THRESHOLD else 0
