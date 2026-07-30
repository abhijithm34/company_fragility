const express = require('express');
const path = require('path');
const fs = require('fs');
const csvParser = require('csv-parser');
const ScoreRun = require('../models/ScoreRun');

const router = express.Router();

/** Resolve column name case-insensitively */
function findColumn(headers, name) {
  const lower = name.toLowerCase();
  return headers.find((h) => h && String(h).toLowerCase() === lower) || null;
}

/** Read all rows from a CSV file */
function readCsvRows(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    if (!fs.existsSync(filePath)) {
      resolve(rows);
      return;
    }
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

/** Feature groups for financial indicator trends (model-specific) */
const FEATURE_GROUPS = {
  leverage: ['Debt_Assets', 'Leverage_Repo'],
  liquidity: ['X1'],
  profitability: ['X2', 'X3', 'Interest_Coverage'],
  cashFlow: ['OCF_TA'],
};

/** All feature columns that may appear in scored output */
const FEATURE_COLS = [
  'X1', 'X2', 'X3', 'X4', 'X5',
  'OCF_TA', 'Interest_Coverage', 'Debt_Assets', 'Repo_Rate', 'Leverage_Repo',
];

/** Five-tier risk categories aligned with Python scoring output */
const RISK_TIERS = [
  [0.2, 'Very Safe'],
  [0.4, 'Low Risk'],
  [0.6, 'Moderate Risk'],
  [0.8, 'High Risk'],
  [1.01, 'Severe Risk'],
];

function getRiskCategory(probability) {
  const p = Number(probability);
  if (Number.isNaN(p)) return 'Unknown';
  for (const [upper, label] of RISK_TIERS) {
    if (p < upper) return label;
  }
  return RISK_TIERS[RISK_TIERS.length - 1][1];
}

/**
 * GET /api/companies/:companyName
 * Returns company-specific analytics: probability history, financial indicator history,
 * latest risk classification, and model explanation factors.
 */
router.get('/api/companies/:companyName', async (req, res) => {
  try {
    const companyName = decodeURIComponent(req.params.companyName || '').trim();
    if (!companyName) {
      res.status(400).json({ message: 'Company name is required.' });
      return;
    }

    const runs = await ScoreRun.find({ status: 'completed', outputFilePath: { $exists: true, $ne: '' } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const companyRows = [];

    for (const run of runs) {
      if (!run.outputFilePath || !fs.existsSync(run.outputFilePath)) continue;
      const rows = await readCsvRows(run.outputFilePath);
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      const companyCol = findColumn(headers, 'company');
      if (!companyCol) continue;

      for (const row of rows) {
        const rowCompany = String(row[companyCol] ?? '').trim();
        if (rowCompany.toLowerCase() !== companyName.toLowerCase()) continue;
        companyRows.push({ ...row, _runId: run._id, _createdAt: run.createdAt });
      }
    }

    if (companyRows.length === 0) {
      res.status(404).json({
        message: `No scored data found for company "${companyName}". Run scoring for this company first.`,
      });
      return;
    }

    const headers = Object.keys(companyRows[0]);
    const quarterCol = findColumn(headers, 'quarter');
    const probCol = findColumn(headers, 'predicted_probability') || findColumn(headers, 'predicted_Probability');
    const labelCol = findColumn(headers, 'predicted_label') || findColumn(headers, 'predicted_Label');

    const byQuarter = new Map();
    for (const row of companyRows) {
      const q = quarterCol ? String(row[quarterCol] ?? '').trim() : row._createdAt?.toString() || 'Unknown';
      if (!q) continue;
      const prob = probCol ? parseFloat(row[probCol]) : NaN;
      const label = labelCol ? parseInt(row[labelCol], 10) : (prob >= 0.5 ? 1 : 0);
      if (!byQuarter.has(q)) {
        byQuarter.set(q, {
          quarter: q,
          probability: Number.isNaN(prob) ? null : prob,
          predictedLabel: Number.isNaN(label) ? null : label,
          row,
        });
      } else {
        const existing = byQuarter.get(q);
        if (row._createdAt && existing.row._createdAt && new Date(row._createdAt) > new Date(existing.row._createdAt)) {
          existing.probability = Number.isNaN(prob) ? null : prob;
          existing.predictedLabel = Number.isNaN(label) ? null : label;
          existing.row = row;
        }
      }
    }

    const sortedQuarters = [...byQuarter.keys()].sort();
    const probabilityHistory = sortedQuarters.map((q) => {
      const { probability } = byQuarter.get(q);
      return { quarter: q, probability: probability != null ? Math.round(probability * 1000) / 1000 : null };
    });

    const financialIndicatorHistory = sortedQuarters.map((q) => {
      const { row } = byQuarter.get(q);
      const point = { quarter: q };
      for (const [group, cols] of Object.entries(FEATURE_GROUPS)) {
        let sum = 0;
        let count = 0;
        for (const col of cols) {
          const val = row[col] != null ? parseFloat(row[col]) : null;
          if (!Number.isNaN(val)) {
            sum += val;
            count += 1;
          }
        }
        point[group] = count > 0 ? Math.round((sum / count) * 1000) / 1000 : null;
      }
      return point;
    });

    const latestQuarter = sortedQuarters[sortedQuarters.length - 1];
    const latestEntry = latestQuarter ? byQuarter.get(latestQuarter) : null;
    const latestProbability = latestEntry?.probability ?? null;
    const latestLabel = latestEntry?.predictedLabel ?? (latestProbability != null && latestProbability >= 0.5 ? 1 : 0);
    const latestRowForRisk = latestEntry?.row ?? companyRows[companyRows.length - 1];
    const riskCategoryCol = findColumn(Object.keys(latestRowForRisk || {}), 'risk_category');
    const riskCategory =
      riskCategoryCol && latestRowForRisk && String(latestRowForRisk[riskCategoryCol] ?? '').trim()
        ? String(latestRowForRisk[riskCategoryCol]).trim()
        : getRiskCategory(latestProbability);
    const isHighRisk = latestLabel === 1;

    const latestRow = latestEntry?.row ?? companyRows[companyRows.length - 1];
    const featureLabels = {
      X1: 'Working capital / Assets',
      X2: 'Retained earnings / Assets',
      X3: 'EBIT / Assets',
      X4: 'Market cap / Liabilities',
      X5: 'Sales / Assets',
      OCF_TA: 'Operating cash flow / Assets',
      Interest_Coverage: 'Interest coverage',
      Debt_Assets: 'Debt / Assets',
      Repo_Rate: 'Repo rate',
      Leverage_Repo: 'Leverage × Repo',
    };

    let factorsIncreasingRisk = [];
    let factorsDecreasingRisk = [];
    let featureImportance = [];
    let useShap = false;

    const shapCols = FEATURE_COLS.filter((col) => latestRow[`shap_${col}`] != null);
    if (shapCols.length > 0) {
      useShap = true;
      const contributions = [];
      for (const col of FEATURE_COLS) {
        const raw = latestRow[`shap_${col}`];
        const contrib = parseFloat(raw);
        if (Number.isNaN(contrib)) continue;
        const label = featureLabels[col] || col;
        contributions.push({ feature: label, contribution: contrib, col });
        if (contrib > 0) {
          factorsIncreasingRisk.push({ feature: label, value: contrib, benchmark: 0, contribution: contrib });
        } else if (contrib < 0) {
          factorsDecreasingRisk.push({ feature: label, value: -contrib, benchmark: 0, contribution: contrib });
        }
      }
      factorsIncreasingRisk.sort((a, b) => b.contribution - a.contribution);
      factorsDecreasingRisk.sort((a, b) => a.contribution - b.contribution);
      featureImportance = contributions
        .map((c) => ({ feature: c.feature, importance: Math.abs(c.contribution) }))
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 10);
    } else {
      const featureValues = {};
      for (const col of FEATURE_COLS) {
        if (latestRow[col] != null) {
          const v = parseFloat(latestRow[col]);
          featureValues[col] = Number.isNaN(v) ? null : v;
        }
      }
      const featureMedians = {};
      for (const col of FEATURE_COLS) {
        const values = companyRows.map((r) => parseFloat(r[col])).filter((v) => !Number.isNaN(v));
        if (values.length === 0) continue;
        values.sort((a, b) => a - b);
        featureMedians[col] = values[Math.floor(values.length / 2)];
      }
      for (const col of FEATURE_COLS) {
        const val = featureValues[col];
        const med = featureMedians[col];
        if (val == null || med == null) continue;
        const label = featureLabels[col] || col;
        if (val > med) factorsIncreasingRisk.push({ feature: label, value: val, benchmark: med });
        else if (val < med) factorsDecreasingRisk.push({ feature: label, value: val, benchmark: med });
      }
      featureImportance = FEATURE_COLS.map((col) => ({
        feature: featureLabels[col] || col,
        importance: 1 / (FEATURE_COLS.indexOf(col) + 1),
      })).sort((a, b) => b.importance - a.importance);
    }

    res.json({
      companyName,
      latest: {
        quarter: latestQuarter ?? null,
        probability: latestProbability,
        riskCategory,
        isHighRisk,
      },
      probabilityHistory,
      financialIndicatorHistory,
      modelExplanation: {
        useShap,
        factorsIncreasingRisk,
        factorsDecreasingRisk,
        featureImportance: featureImportance.slice(0, 10),
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load company profile', error: err.message });
  }
});

router.get('/api/heatmap', async (req, res) => {
  try {
    const runs = await ScoreRun.find({ status: 'completed', outputFilePath: { $exists: true, $ne: '' } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const data = {};
    const quartersSet = new Set();
    const companiesSet = new Set();

    for (const run of runs) {
      if (!run.outputFilePath || !fs.existsSync(run.outputFilePath)) continue;
      const rows = await readCsvRows(run.outputFilePath);
      if (rows.length === 0) continue;

      const headers = Object.keys(rows[0]);
      const companyCol = findColumn(headers, 'company');
      const quarterCol = findColumn(headers, 'quarter');
      const probCol = findColumn(headers, 'predicted_probability') || findColumn(headers, 'predicted_Probability');

      if (!companyCol || !probCol) continue;

      for (const row of rows) {
        const companyName = String(row[companyCol] ?? '').trim();
        const quarter = quarterCol ? String(row[quarterCol] ?? '').trim() : run.createdAt?.toString() || 'Unknown';
        const prob = parseFloat(row[probCol]);

        if (!companyName || !quarter || Number.isNaN(prob)) continue;

        if (!data[companyName]) {
          data[companyName] = {};
        }

        // Keep the latest value seen (fastest and most recent runs are traversed first)
        if (data[companyName][quarter] === undefined) {
          data[companyName][quarter] = prob;
          quartersSet.add(quarter);
          companiesSet.add(companyName);
        }
      }
    }

    const quarters = Array.from(quartersSet).sort();
    const companies = Array.from(companiesSet).sort((a, b) => a.localeCompare(b));

    res.json({ quarters, companies, data });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate heatmap data', error: err.message });
  }
});

module.exports = router;
