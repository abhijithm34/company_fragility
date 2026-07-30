"""Model evaluation: metrics computation and publication-quality visualization."""
from typing import Tuple

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.colors import LinearSegmentedColormap
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

from .config import FIGURES_DIR

# ─── Professional style configuration ───────────────────────────────────────

# Color palette (modern, accessible)
COLORS = {
    "primary": "#6366f1",       # Indigo
    "secondary": "#ec4899",     # Pink
    "accent": "#06b6d4",        # Cyan
    "success": "#10b981",       # Emerald
    "warning": "#f59e0b",       # Amber
    "danger": "#ef4444",        # Red
    "safe": "#22c55e",          # Green
    "bg_dark": "#0f172a",       # Slate 900
    "bg_card": "#1e293b",       # Slate 800
    "text": "#f8fafc",          # Slate 50
    "text_muted": "#94a3b8",    # Slate 400
    "grid": "#334155",          # Slate 700
    "gradient_start": "#6366f1",
    "gradient_end": "#a855f7",
}

# Risk tier colors
RISK_COLORS = ["#22c55e", "#84cc16", "#f59e0b", "#f97316", "#ef4444"]
RISK_LABELS = ["Very Safe", "Low Risk", "Moderate", "High Risk", "Severe"]


def _setup_style():
    """Configure matplotlib for dark, professional figures."""
    plt.rcParams.update({
        "figure.facecolor": COLORS["bg_dark"],
        "axes.facecolor": COLORS["bg_card"],
        "axes.edgecolor": COLORS["grid"],
        "axes.labelcolor": COLORS["text"],
        "axes.titlesize": 14,
        "axes.titleweight": "bold",
        "axes.labelsize": 11,
        "axes.grid": True,
        "grid.color": COLORS["grid"],
        "grid.alpha": 0.3,
        "grid.linestyle": "--",
        "xtick.color": COLORS["text_muted"],
        "ytick.color": COLORS["text_muted"],
        "xtick.labelsize": 9,
        "ytick.labelsize": 9,
        "text.color": COLORS["text"],
        "legend.facecolor": COLORS["bg_card"],
        "legend.edgecolor": COLORS["grid"],
        "legend.fontsize": 9,
        "legend.framealpha": 0.9,
        "font.family": "sans-serif",
        "font.sans-serif": ["SF Pro Display", "Helvetica Neue", "Arial", "DejaVu Sans"],
        "savefig.facecolor": COLORS["bg_dark"],
        "savefig.edgecolor": "none",
        "savefig.bbox": "tight",
        "savefig.dpi": 200,
    })


def _add_watermark(ax, text="Corporate Fragility Model"):
    """Add subtle branding watermark."""
    ax.text(
        0.98, 0.02, text,
        transform=ax.transAxes,
        fontsize=7,
        color=COLORS["text_muted"],
        alpha=0.4,
        ha="right",
        va="bottom",
        style="italic",
    )


def _gradient_fill(ax, x, y, color_start, color_end, alpha=0.3):
    """Add gradient fill under a curve."""
    from matplotlib.collections import PolyCollection
    verts = [(x[0], 0)] + list(zip(x, y)) + [(x[-1], 0)]
    poly = plt.Polygon(verts, alpha=alpha, color=color_start)
    ax.add_patch(poly)


def _plot_roc_curve(y_true: np.ndarray, y_prob: np.ndarray, split_name: str) -> None:
    """Professional ROC curve with gradient fill and confidence visual."""
    _setup_style()
    fpr, tpr, thresholds = roc_curve(y_true, y_prob)
    auc_val = roc_auc_score(y_true, y_prob)

    fig, ax = plt.subplots(figsize=(7, 6))

    # Fill area under curve with gradient
    ax.fill_between(fpr, tpr, alpha=0.15, color=COLORS["primary"])
    ax.fill_between(fpr, tpr, alpha=0.08, color=COLORS["gradient_end"])

    # Main ROC curve
    ax.plot(fpr, tpr, color=COLORS["primary"], linewidth=2.5,
            label=f"ROC Curve (AUC = {auc_val:.4f})", zorder=5)

    # Diagonal reference
    ax.plot([0, 1], [0, 1], color=COLORS["text_muted"], linewidth=1,
            linestyle="--", alpha=0.7, label="Random Classifier")

    # Find optimal threshold point (Youden's J)
    j_scores = tpr - fpr
    best_idx = np.argmax(j_scores)
    ax.scatter(fpr[best_idx], tpr[best_idx], color=COLORS["warning"],
               s=100, zorder=10, edgecolors="white", linewidth=2)
    ax.annotate(
        f"Optimal\n(FPR={fpr[best_idx]:.2f}, TPR={tpr[best_idx]:.2f})",
        xy=(fpr[best_idx], tpr[best_idx]),
        xytext=(fpr[best_idx] + 0.15, tpr[best_idx] - 0.1),
        fontsize=8, color=COLORS["warning"],
        arrowprops=dict(arrowstyle="->", color=COLORS["warning"], lw=1.5),
    )

    # AUC score badge
    ax.text(0.55, 0.15, f"AUC = {auc_val:.4f}",
            transform=ax.transAxes, fontsize=20, fontweight="bold",
            color=COLORS["primary"], alpha=0.8, ha="center")

    ax.set_xlabel("False Positive Rate", fontsize=11, labelpad=10)
    ax.set_ylabel("True Positive Rate", fontsize=11, labelpad=10)
    ax.set_title(f"ROC Curve — {split_name} Set", fontsize=14, fontweight="bold", pad=15)
    ax.legend(loc="lower right", framealpha=0.9)
    ax.set_xlim(-0.02, 1.02)
    ax.set_ylim(-0.02, 1.05)
    _add_watermark(ax)

    out_path = FIGURES_DIR / f"roc_{split_name.lower()}.png"
    fig.savefig(out_path)
    plt.close(fig)
    print(f"  ✓ ROC curve ({split_name}) → {out_path.name}")


def _plot_pr_curve(y_true: np.ndarray, y_prob: np.ndarray, split_name: str) -> None:
    """Professional Precision-Recall curve."""
    _setup_style()
    precision, recall, thresholds = precision_recall_curve(y_true, y_prob)
    ap_val = average_precision_score(y_true, y_prob)
    baseline = np.mean(y_true)

    fig, ax = plt.subplots(figsize=(7, 6))

    # Fill under curve
    ax.fill_between(recall, precision, alpha=0.15, color=COLORS["secondary"])

    # Main PR curve
    ax.plot(recall, precision, color=COLORS["secondary"], linewidth=2.5,
            label=f"PR Curve (AP = {ap_val:.4f})", zorder=5)

    # Baseline
    ax.axhline(y=baseline, color=COLORS["text_muted"], linestyle="--",
               linewidth=1, alpha=0.7, label=f"Baseline (prevalence = {baseline:.3f})")

    # F1 iso-curves
    for f1_val in [0.4, 0.6, 0.8, 0.9]:
        x = np.linspace(0.01, 1.0, 100)
        y = f1_val * x / (2 * x - f1_val)
        mask = (y >= 0) & (y <= 1) & (x >= 0)
        ax.plot(x[mask], y[mask], color=COLORS["grid"], linewidth=0.7,
                alpha=0.5, linestyle=":")
        # Label at the edge
        valid = np.where(mask)[0]
        if len(valid) > 0:
            idx = valid[-1]
            ax.text(x[idx], y[idx] + 0.02, f"F1={f1_val}",
                    fontsize=7, color=COLORS["text_muted"], alpha=0.6)

    # AP badge
    ax.text(0.45, 0.15, f"AP = {ap_val:.4f}",
            transform=ax.transAxes, fontsize=20, fontweight="bold",
            color=COLORS["secondary"], alpha=0.8, ha="center")

    ax.set_xlabel("Recall", fontsize=11, labelpad=10)
    ax.set_ylabel("Precision", fontsize=11, labelpad=10)
    ax.set_title(f"Precision–Recall Curve — {split_name} Set", fontsize=14, fontweight="bold", pad=15)
    ax.legend(loc="upper right", framealpha=0.9)
    ax.set_xlim(-0.02, 1.02)
    ax.set_ylim(0, 1.08)
    _add_watermark(ax)

    out_path = FIGURES_DIR / f"pr_{split_name.lower()}.png"
    fig.savefig(out_path)
    plt.close(fig)
    print(f"  ✓ PR curve ({split_name}) → {out_path.name}")


def _plot_predicted_vs_actual(y_true: np.ndarray, y_prob: np.ndarray, split_name: str) -> None:
    """Beautiful overlapping density plot with KDE."""
    _setup_style()
    fig, ax = plt.subplots(figsize=(8, 5))

    # KDE for each class
    from scipy.stats import gaussian_kde

    prob_healthy = y_prob[y_true == 0]
    prob_distress = y_prob[y_true == 1]

    if len(prob_healthy) > 1:
        kde_h = gaussian_kde(prob_healthy, bw_method=0.1)
        x_h = np.linspace(0, 1, 200)
        y_h = kde_h(x_h)
        ax.plot(x_h, y_h, color=COLORS["success"], linewidth=2, label="Healthy (0)")
        ax.fill_between(x_h, y_h, alpha=0.2, color=COLORS["success"])

    if len(prob_distress) > 1:
        kde_d = gaussian_kde(prob_distress, bw_method=0.1)
        x_d = np.linspace(0, 1, 200)
        y_d = kde_d(x_d)
        ax.plot(x_d, y_d, color=COLORS["danger"], linewidth=2, label="Distressed (1)")
        ax.fill_between(x_d, y_d, alpha=0.2, color=COLORS["danger"])

    # Decision boundary
    ax.axvline(x=0.5, color=COLORS["warning"], linewidth=1.5, linestyle="--",
               alpha=0.8, label="Decision Threshold (0.5)")

    # Risk zones
    zone_colors = [(0, 0.2, COLORS["success"]), (0.2, 0.4, "#84cc16"),
                   (0.4, 0.6, COLORS["warning"]), (0.6, 0.8, "#f97316"),
                   (0.8, 1.0, COLORS["danger"])]
    for x_start, x_end, color in zone_colors:
        ax.axvspan(x_start, x_end, alpha=0.03, color=color)

    ax.set_xlabel("Predicted Probability of Distress", fontsize=11, labelpad=10)
    ax.set_ylabel("Density", fontsize=11, labelpad=10)
    ax.set_title(f"Score Distribution by Class — {split_name} Set", fontsize=14, fontweight="bold", pad=15)
    ax.legend(loc="upper center", framealpha=0.9, ncol=3)
    ax.set_xlim(-0.02, 1.02)
    _add_watermark(ax)

    out_path = FIGURES_DIR / f"pred_vs_actual_{split_name.lower()}.png"
    fig.savefig(out_path)
    plt.close(fig)
    print(f"  ✓ Score distribution ({split_name}) → {out_path.name}")


def _plot_time_pred_vs_actual(
    quarters: np.ndarray, y_true: np.ndarray, y_prob: np.ndarray, split_name: str
) -> None:
    """Time series of predicted vs actual with smooth lines and shaded gap."""
    _setup_style()
    df = pd.DataFrame({"Quarter": quarters, "y_true": y_true, "y_prob": y_prob})
    grouped = (
        df.groupby("Quarter")
        .agg(actual_rate=("y_true", "mean"), predicted_mean=("y_prob", "mean"),
             pred_std=("y_prob", "std"), count=("y_true", "count"))
        .reset_index()
        .sort_values("Quarter")
    )
    grouped["pred_std"] = grouped["pred_std"].fillna(0)

    fig, ax = plt.subplots(figsize=(10, 5))

    x = range(len(grouped))
    labels = [str(q)[:10] for q in grouped["Quarter"]]

    # Confidence band for predictions
    pred_upper = grouped["predicted_mean"] + grouped["pred_std"]
    pred_lower = (grouped["predicted_mean"] - grouped["pred_std"]).clip(lower=0)
    ax.fill_between(x, pred_lower, pred_upper, alpha=0.15, color=COLORS["primary"])

    # Lines
    ax.plot(x, grouped["predicted_mean"], color=COLORS["primary"], linewidth=2.5,
            marker="o", markersize=5, markerfacecolor="white", markeredgewidth=1.5,
            label="Mean Predicted Probability", zorder=5)
    ax.plot(x, grouped["actual_rate"], color=COLORS["danger"], linewidth=2.5,
            marker="s", markersize=5, markerfacecolor="white", markeredgewidth=1.5,
            label="Actual Distress Rate", zorder=5)

    # Shade gap between predicted and actual
    ax.fill_between(x, grouped["predicted_mean"], grouped["actual_rate"],
                    alpha=0.08, color=COLORS["warning"])

    ax.set_xticks(x[::max(1, len(x) // 10)])
    ax.set_xticklabels([labels[i] for i in range(0, len(labels), max(1, len(labels) // 10))],
                       rotation=45, ha="right", fontsize=8)
    ax.set_xlabel("Quarter", fontsize=11, labelpad=10)
    ax.set_ylabel("Probability / Rate", fontsize=11, labelpad=10)
    ax.set_title(f"Predicted vs Actual Distress Over Time — {split_name} Set",
                 fontsize=14, fontweight="bold", pad=15)
    ax.legend(loc="upper left", framealpha=0.9)
    ax.set_ylim(bottom=-0.02)
    _add_watermark(ax)

    out_path = FIGURES_DIR / f"time_pred_vs_actual_{split_name.lower()}.png"
    fig.savefig(out_path)
    plt.close(fig)
    print(f"  ✓ Time series ({split_name}) → {out_path.name}")


def _plot_confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, split_name: str) -> None:
    """Beautiful annotated confusion matrix heatmap."""
    _setup_style()
    cm = confusion_matrix(y_true, y_pred)
    cm_pct = cm.astype(float) / cm.sum() * 100

    fig, ax = plt.subplots(figsize=(6, 5))

    # Custom colormap
    cmap = LinearSegmentedColormap.from_list(
        "custom", [COLORS["bg_card"], COLORS["primary"], COLORS["gradient_end"]]
    )

    sns.heatmap(
        cm, annot=False, fmt="d", cmap=cmap, ax=ax,
        linewidths=2, linecolor=COLORS["bg_dark"],
        cbar_kws={"label": "Count", "shrink": 0.8},
        square=True,
    )

    # Custom annotations with counts and percentages
    for i in range(2):
        for j in range(2):
            count = cm[i, j]
            pct = cm_pct[i, j]
            ax.text(j + 0.5, i + 0.4, f"{count}",
                    ha="center", va="center", fontsize=22, fontweight="bold",
                    color="white")
            ax.text(j + 0.5, i + 0.65, f"({pct:.1f}%)",
                    ha="center", va="center", fontsize=10,
                    color=COLORS["text_muted"])

    ax.set_xlabel("Predicted Label", fontsize=11, labelpad=10)
    ax.set_ylabel("True Label", fontsize=11, labelpad=10)
    ax.set_xticklabels(["Healthy (0)", "Distressed (1)"], fontsize=10)
    ax.set_yticklabels(["Healthy (0)", "Distressed (1)"], fontsize=10, rotation=0)
    ax.set_title(f"Confusion Matrix — {split_name} Set", fontsize=14, fontweight="bold", pad=15)
    _add_watermark(ax)

    out_path = FIGURES_DIR / f"confusion_matrix_{split_name.lower()}.png"
    fig.savefig(out_path)
    plt.close(fig)
    print(f"  ✓ Confusion matrix ({split_name}) → {out_path.name}")


def _plot_metrics_summary(
    y_train: np.ndarray, y_train_prob: np.ndarray,
    y_test: np.ndarray, y_test_prob: np.ndarray,
) -> None:
    """Side-by-side bar chart comparing train vs test metrics."""
    _setup_style()
    y_train_pred = (y_train_prob >= 0.5).astype(int)
    y_test_pred = (y_test_prob >= 0.5).astype(int)

    metrics_names = ["Accuracy", "ROC-AUC", "PR-AUC", "Precision", "Recall", "F1-Score"]
    train_vals = [
        accuracy_score(y_train, y_train_pred),
        roc_auc_score(y_train, y_train_prob),
        average_precision_score(y_train, y_train_prob),
        precision_score(y_train, y_train_pred, zero_division=0),
        recall_score(y_train, y_train_pred, zero_division=0),
        f1_score(y_train, y_train_pred, zero_division=0),
    ]
    test_vals = [
        accuracy_score(y_test, y_test_pred),
        roc_auc_score(y_test, y_test_prob),
        average_precision_score(y_test, y_test_prob),
        precision_score(y_test, y_test_pred, zero_division=0),
        recall_score(y_test, y_test_pred, zero_division=0),
        f1_score(y_test, y_test_pred, zero_division=0),
    ]

    fig, ax = plt.subplots(figsize=(10, 5))

    x = np.arange(len(metrics_names))
    width = 0.35

    bars1 = ax.bar(x - width / 2, train_vals, width, label="Train",
                   color=COLORS["primary"], alpha=0.85, edgecolor="white", linewidth=0.5)
    bars2 = ax.bar(x + width / 2, test_vals, width, label="Test",
                   color=COLORS["secondary"], alpha=0.85, edgecolor="white", linewidth=0.5)

    # Value labels on bars
    for bar in bars1:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2., height + 0.01,
                f"{height:.3f}", ha="center", va="bottom", fontsize=8,
                color=COLORS["text_muted"])
    for bar in bars2:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2., height + 0.01,
                f"{height:.3f}", ha="center", va="bottom", fontsize=8,
                color=COLORS["text_muted"])

    ax.set_xlabel("Metric", fontsize=11, labelpad=10)
    ax.set_ylabel("Score", fontsize=11, labelpad=10)
    ax.set_title("Model Performance Summary — Train vs Test",
                 fontsize=14, fontweight="bold", pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(metrics_names, fontsize=10)
    ax.set_ylim(0, 1.12)
    ax.legend(loc="upper right", framealpha=0.9)
    ax.axhline(y=1.0, color=COLORS["grid"], linewidth=0.8, linestyle=":", alpha=0.5)
    _add_watermark(ax)

    out_path = FIGURES_DIR / "metrics_summary.png"
    fig.savefig(out_path)
    plt.close(fig)
    print(f"  ✓ Metrics summary → {out_path.name}")


def _plot_calibration_curve(y_true: np.ndarray, y_prob: np.ndarray, split_name: str) -> None:
    """Calibration plot (reliability diagram)."""
    _setup_style()
    fig, ax = plt.subplots(figsize=(7, 6))

    # Bin predictions
    n_bins = 10
    bin_edges = np.linspace(0, 1, n_bins + 1)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
    bin_true_rates = []
    bin_counts = []

    for i in range(n_bins):
        mask = (y_prob >= bin_edges[i]) & (y_prob < bin_edges[i + 1])
        if mask.sum() > 0:
            bin_true_rates.append(y_true[mask].mean())
            bin_counts.append(mask.sum())
        else:
            bin_true_rates.append(np.nan)
            bin_counts.append(0)

    bin_true_rates = np.array(bin_true_rates)
    bin_counts = np.array(bin_counts)
    valid = ~np.isnan(bin_true_rates)

    # Perfect calibration line
    ax.plot([0, 1], [0, 1], color=COLORS["text_muted"], linestyle="--",
            linewidth=1, alpha=0.7, label="Perfectly Calibrated")

    # Calibration curve
    ax.plot(bin_centers[valid], bin_true_rates[valid], color=COLORS["accent"],
            linewidth=2.5, marker="o", markersize=8, markerfacecolor="white",
            markeredgewidth=2, label=f"Model ({split_name})", zorder=5)

    # Bar chart of bin counts on secondary axis
    ax2 = ax.twinx()
    ax2.bar(bin_centers, bin_counts, width=0.08, alpha=0.15, color=COLORS["primary"])
    ax2.set_ylabel("Count per bin", fontsize=9, color=COLORS["text_muted"])
    ax2.tick_params(axis="y", colors=COLORS["text_muted"])
    ax2.set_ylim(0, max(bin_counts) * 4 if max(bin_counts) > 0 else 1)

    ax.set_xlabel("Mean Predicted Probability", fontsize=11, labelpad=10)
    ax.set_ylabel("Fraction of Positives", fontsize=11, labelpad=10)
    ax.set_title(f"Calibration Curve — {split_name} Set", fontsize=14, fontweight="bold", pad=15)
    ax.legend(loc="upper left", framealpha=0.9)
    ax.set_xlim(-0.02, 1.02)
    ax.set_ylim(-0.02, 1.08)
    _add_watermark(ax)

    out_path = FIGURES_DIR / f"calibration_{split_name.lower()}.png"
    fig.savefig(out_path)
    plt.close(fig)
    print(f"  ✓ Calibration curve ({split_name}) → {out_path.name}")


def _plot_risk_distribution(y_prob: np.ndarray, split_name: str) -> None:
    """Pie/donut chart of risk category distribution."""
    _setup_style()

    # Categorize
    thresholds = [0.2, 0.4, 0.6, 0.8]
    categories = np.digitize(y_prob, thresholds)
    counts = np.bincount(categories, minlength=5)

    fig, ax = plt.subplots(figsize=(7, 7))

    # Donut chart
    wedges, texts, autotexts = ax.pie(
        counts, labels=RISK_LABELS, colors=RISK_COLORS,
        autopct=lambda pct: f"{pct:.1f}%\n({int(round(pct/100*len(y_prob)))})" if pct > 2 else "",
        startangle=90, pctdistance=0.78,
        wedgeprops=dict(width=0.45, edgecolor=COLORS["bg_dark"], linewidth=2),
        textprops=dict(color=COLORS["text"], fontsize=9),
    )

    for autotext in autotexts:
        autotext.set_fontsize(8)
        autotext.set_color(COLORS["text"])

    # Center text
    ax.text(0, 0, f"n={len(y_prob)}", ha="center", va="center",
            fontsize=16, fontweight="bold", color=COLORS["text"])
    ax.text(0, -0.12, "companies", ha="center", va="center",
            fontsize=9, color=COLORS["text_muted"])

    ax.set_title(f"Risk Category Distribution — {split_name} Set",
                 fontsize=14, fontweight="bold", pad=20)

    out_path = FIGURES_DIR / f"risk_distribution_{split_name.lower()}.png"
    fig.savefig(out_path)
    plt.close(fig)
    print(f"  ✓ Risk distribution ({split_name}) → {out_path.name}")


# ─── Main evaluation function ───────────────────────────────────────────────

def evaluate_model(
    y_train: np.ndarray,
    y_train_prob: np.ndarray,
    y_test: np.ndarray,
    y_test_prob: np.ndarray,
    train_quarters: np.ndarray,
    test_quarters: np.ndarray,
    cutoff,
) -> None:
    """Print metrics and save professional evaluation plots."""
    y_train_pred = (y_train_prob >= 0.5).astype(int)
    y_test_pred = (y_test_prob >= 0.5).astype(int)

    print(f"Time-based split cutoff quarter: {cutoff}")

    print("\n┌─────────────────────────────────────────┐")
    print("│         TRAIN PERFORMANCE               │")
    print("├─────────────────────────────────────────┤")
    print(f"│  Accuracy:      {accuracy_score(y_train, y_train_pred):.4f}                │")
    print(f"│  ROC-AUC:       {roc_auc_score(y_train, y_train_prob):.4f}                │")
    print(f"│  PR-AUC:        {average_precision_score(y_train, y_train_prob):.4f}                │")
    print(f"│  Precision:     {precision_score(y_train, y_train_pred, zero_division=0):.4f}                │")
    print(f"│  Recall:        {recall_score(y_train, y_train_pred, zero_division=0):.4f}                │")
    print(f"│  F1-score:      {f1_score(y_train, y_train_pred, zero_division=0):.4f}                │")
    print(f"│  Brier score:   {brier_score_loss(y_train, y_train_prob):.4f}                │")
    print(f"│  Log loss:      {log_loss(y_train, y_train_prob):.4f}                │")
    print("└─────────────────────────────────────────┘")

    print("\n┌─────────────────────────────────────────┐")
    print("│         TEST PERFORMANCE                │")
    print("├─────────────────────────────────────────┤")
    print(f"│  Accuracy:      {accuracy_score(y_test, y_test_pred):.4f}                │")
    print(f"│  ROC-AUC:       {roc_auc_score(y_test, y_test_prob):.4f}                │")
    print(f"│  PR-AUC:        {average_precision_score(y_test, y_test_prob):.4f}                │")
    print(f"│  Precision:     {precision_score(y_test, y_test_pred, zero_division=0):.4f}                │")
    print(f"│  Recall:        {recall_score(y_test, y_test_pred, zero_division=0):.4f}                │")
    print(f"│  F1-score:      {f1_score(y_test, y_test_pred, zero_division=0):.4f}                │")
    print(f"│  Brier score:   {brier_score_loss(y_test, y_test_prob):.4f}                │")
    print(f"│  Log loss:      {log_loss(y_test, y_test_prob):.4f}                │")
    print("└─────────────────────────────────────────┘")

    print("\nClassification report (test):")
    print(classification_report(y_test, y_test_pred, digits=4))
    print("Confusion matrix (test):")
    print(confusion_matrix(y_test, y_test_pred))

    # Generate professional figures
    print("\nGenerating professional evaluation figures...")
    print("-" * 45)

    _plot_roc_curve(y_train, y_train_prob, split_name="Train")
    _plot_roc_curve(y_test, y_test_prob, split_name="Test")
    _plot_pr_curve(y_train, y_train_prob, split_name="Train")
    _plot_pr_curve(y_test, y_test_prob, split_name="Test")
    _plot_predicted_vs_actual(y_train, y_train_prob, split_name="Train")
    _plot_predicted_vs_actual(y_test, y_test_prob, split_name="Test")
    _plot_time_pred_vs_actual(train_quarters, y_train, y_train_prob, split_name="Train")
    _plot_time_pred_vs_actual(test_quarters, y_test, y_test_prob, split_name="Test")
    _plot_confusion_matrix(y_test, y_test_pred, split_name="Test")
    _plot_confusion_matrix(y_train, y_train_pred, split_name="Train")
    _plot_metrics_summary(y_train, y_train_prob, y_test, y_test_prob)
    _plot_calibration_curve(y_test, y_test_prob, split_name="Test")
    _plot_risk_distribution(y_test_prob, split_name="Test")
    _plot_risk_distribution(y_train_prob, split_name="Train")

    print("-" * 45)
    print(f"  All figures saved to {FIGURES_DIR}/")
