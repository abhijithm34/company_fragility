from typing import Tuple

import matplotlib.pyplot as plt
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


def _plot_roc_curve(y_true: np.ndarray, y_prob: np.ndarray, split_name: str) -> None:
    fpr, tpr, _ = roc_curve(y_true, y_prob)
    auc_val = roc_auc_score(y_true, y_prob)

    plt.figure(figsize=(6, 5))
    plt.plot(fpr, tpr, label=f"ROC (AUC = {auc_val:.3f})")
    plt.plot([0, 1], [0, 1], "k--", label="Random")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title(f"ROC Curve – {split_name}")
    plt.legend(loc="lower right")
    out_path = FIGURES_DIR / f"roc_{split_name.lower()}.png"
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"Saved ROC curve for {split_name} to {out_path}")


def _plot_pr_curve(y_true: np.ndarray, y_prob: np.ndarray, split_name: str) -> None:
    precision, recall, _ = precision_recall_curve(y_true, y_prob)
    ap_val = average_precision_score(y_true, y_prob)

    plt.figure(figsize=(6, 5))
    plt.plot(recall, precision, label=f"PR (AP = {ap_val:.3f})")
    baseline = np.mean(y_true)
    plt.hlines(baseline, 0, 1, colors="k", linestyles="--", label=f"Baseline (p={baseline:.3f})")
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title(f"Precision–Recall Curve – {split_name}")
    plt.legend(loc="upper right")
    out_path = FIGURES_DIR / f"pr_{split_name.lower()}.png"
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"Saved PR curve for {split_name} to {out_path}")


def _plot_predicted_vs_actual(y_true: np.ndarray, y_prob: np.ndarray, split_name: str) -> None:
    """Visualize predicted probability distribution by actual class."""
    plt.figure(figsize=(6, 5))
    sns.histplot(
        x=y_prob,
        hue=y_true,
        bins=30,
        stat="density",
        common_norm=False,
        palette={0: "tab:blue", 1: "tab:red"},
        alpha=0.6,
    )
    plt.xlabel("Predicted probability of distress")
    plt.ylabel("Density")
    plt.title(f"Predicted vs Actual – {split_name}")

    # Make sure legend labels correctly reflect class meaning
    ax = plt.gca()
    handles, labels = ax.get_legend_handles_labels()
    label_map = {"0": "0 (non-distress)", "1": "1 (distress)"}
    new_handles = []
    new_labels = []
    for h, lab in zip(handles, labels):
        if lab in label_map:
            new_handles.append(h)
            new_labels.append(label_map[lab])
    if new_handles:
        ax.legend(new_handles, new_labels, title="Actual label")
    out_path = FIGURES_DIR / f"pred_vs_actual_{split_name.lower()}.png"
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"Saved predicted-vs-actual plot for {split_name} to {out_path}")


def _plot_time_pred_vs_actual(
    quarters: np.ndarray, y_true: np.ndarray, y_prob: np.ndarray, split_name: str
) -> None:
    """Plot a time series of average predicted vs actual distress rate by quarter.

    For each quarter on the x-axis we show:
    - the mean predicted probability of distress (model forecast at t)
    - the realized fraction of companies that became distressed (label at t+4)
    """
    df = pd.DataFrame(
        {
            "Quarter": quarters,
            "y_true": y_true,
            "y_prob": y_prob,
        }
    )
    grouped = (
        df.groupby("Quarter")
        .agg(actual_rate=("y_true", "mean"), predicted_mean=("y_prob", "mean"))
        .reset_index()
        .sort_values("Quarter")
    )

    plt.figure(figsize=(8, 4))
    plt.plot(
        grouped["Quarter"],
        grouped["predicted_mean"],
        marker="o",
        label="Mean predicted distress probability",
    )
    plt.plot(
        grouped["Quarter"],
        grouped["actual_rate"],
        marker="s",
        label="Actual distress rate (labels)",
    )
    plt.xlabel("Quarter (t)")
    plt.ylabel("Probability / rate")
    plt.title(f"Predicted vs Actual Distress Over Time – {split_name}")
    plt.legend()
    plt.xticks(rotation=45)
    plt.tight_layout()
    out_path = FIGURES_DIR / f"time_pred_vs_actual_{split_name.lower()}.png"
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"Saved time-series predicted-vs-actual plot for {split_name} to {out_path}")


def evaluate_model(
    y_train: np.ndarray,
    y_train_prob: np.ndarray,
    y_test: np.ndarray,
    y_test_prob: np.ndarray,
    train_quarters: np.ndarray,
    test_quarters: np.ndarray,
    cutoff,
) -> None:
    """Print metrics and save standard evaluation plots."""
    y_train_pred = (y_train_prob >= 0.5).astype(int)
    y_test_pred = (y_test_prob >= 0.5).astype(int)

    print(f"Time-based split cutoff quarter: {cutoff}")

    print("\n=== Train performance ===")
    print(f"  Accuracy:    {accuracy_score(y_train, y_train_pred):.4f}")
    print(f"  ROC-AUC:     {roc_auc_score(y_train, y_train_prob):.4f}")
    print(f"  PR-AUC:      {average_precision_score(y_train, y_train_prob):.4f}")
    print(f"  Precision:   {precision_score(y_train, y_train_pred, zero_division=0):.4f}")
    print(f"  Recall:      {recall_score(y_train, y_train_pred, zero_division=0):.4f}")
    print(f"  F1-score:    {f1_score(y_train, y_train_pred, zero_division=0):.4f}")
    print(f"  Brier score: {brier_score_loss(y_train, y_train_prob):.4f}")
    print(f"  Log loss:    {log_loss(y_train, y_train_prob):.4f}")

    print("\n=== Test performance ===")
    print(f"  Accuracy:    {accuracy_score(y_test, y_test_pred):.4f}")
    print(f"  ROC-AUC:     {roc_auc_score(y_test, y_test_prob):.4f}")
    print(f"  PR-AUC:      {average_precision_score(y_test, y_test_prob):.4f}")
    print(f"  Precision:   {precision_score(y_test, y_test_pred, zero_division=0):.4f}")
    print(f"  Recall:      {recall_score(y_test, y_test_pred, zero_division=0):.4f}")
    print(f"  F1-score:    {f1_score(y_test, y_test_pred, zero_division=0):.4f}")
    print(f"  Brier score: {brier_score_loss(y_test, y_test_prob):.4f}")
    print(f"  Log loss:    {log_loss(y_test, y_test_prob):.4f}")
    print("\nClassification report (test):")
    print(classification_report(y_test, y_test_pred, digits=4))
    print("Confusion matrix (test):")
    print(confusion_matrix(y_test, y_test_pred))

    # Save graphs for train and test
    _plot_roc_curve(y_train, y_train_prob, split_name="Train")
    _plot_roc_curve(y_test, y_test_prob, split_name="Test")
    _plot_pr_curve(y_train, y_train_prob, split_name="Train")
    _plot_pr_curve(y_test, y_test_prob, split_name="Test")
    _plot_predicted_vs_actual(y_train, y_train_prob, split_name="Train")
    _plot_predicted_vs_actual(y_test, y_test_prob, split_name="Test")
    _plot_time_pred_vs_actual(train_quarters, y_train, y_train_prob, split_name="Train")
    _plot_time_pred_vs_actual(test_quarters, y_test, y_test_prob, split_name="Test")

