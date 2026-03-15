const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const csvParser = require('csv-parser');
const ScoreRun = require('../models/ScoreRun');

const router = express.Router();

// projectRoot is the repository root (one level above `backend`)
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const uploadsDir = path.join(projectRoot, 'backend', 'uploads');
const outputsDir = path.join(projectRoot, 'backend', 'outputs');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}

function logDebug(entry) {
  try {
    const line = JSON.stringify({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      sessionId: '8856db',
      ...entry,
    });
    fs.appendFile(path.join(projectRoot, 'debug-8856db.log'), `${line}\n`, () => {});
  } catch {
    // ignore logging errors
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      cb(new Error('Only CSV files are allowed'));
      return;
    }
    cb(null, true);
  },
});

/** Resolve column name case-insensitively (e.g. 'quarter' -> 'Quarter') */
function findColumn(headers, name) {
  const lower = name.toLowerCase();
  return headers.find((h) => h && String(h).toLowerCase() === lower) || null;
}

/** Read entire CSV into array of row objects. */
function readCsvRows(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = fs.createReadStream(filePath).pipe(csvParser());
    stream.on('data', (row) => rows.push(row));
    stream.on('end', () => resolve(rows));
    stream.on('error', reject);
  });
}

/** Get headers from first row of CSV (keys of first parsed row). */
function readCsvHeaders(filePath) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath).pipe(csvParser());
    stream.on('data', (row) => {
      stream.destroy();
      resolve(Object.keys(row));
    });
    stream.on('end', () => resolve([]));
    stream.on('error', reject);
  });
}

/** Escape a value for CSV output. */
function escapeCsvValue(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Write rows (array of objects) to CSV file. */
function writeCsvRows(filePath, rows, headers) {
  if (rows.length === 0) {
    fs.writeFileSync(filePath, headers.join(',') + '\n', 'utf8');
    return;
  }
  const headerLine = headers.join(',');
  const dataLines = rows.map((r) => headers.map((h) => escapeCsvValue(r[h])).join(','));
  fs.writeFileSync(filePath, [headerLine, ...dataLines].join('\n'), 'utf8');
}

/**
 * Validate and filter CSV: require quarter and company columns, ensure selected quarter exists.
 * Filter to selected companies only but include ALL quarters for those companies, so that
 * company profile graphs can show full trend data. Returns { filteredPath, error }.
 */
async function validateAndFilterCsv(originalPath, predictionQuarter, selectedCompanies, outputsDir) {
  const rows = await readCsvRows(originalPath);
  if (rows.length === 0) {
    return { error: 'The uploaded dataset is empty.' };
  }
  const headers = Object.keys(rows[0]);
  const quarterCol = findColumn(headers, 'quarter');
  const companyCol = findColumn(headers, 'company');

  if (!quarterCol) {
    return { error: 'The dataset must contain a quarter column.' };
  }
  if (!companyCol) {
    return { error: 'The dataset must contain a company column.' };
  }

  const quartersInData = [...new Set(rows.map((r) => String(r[quarterCol] ?? '').trim()))].filter(Boolean);
  if (!quartersInData.length) {
    return { error: 'No quarter values found in the dataset.' };
  }
  if (!predictionQuarter || !quartersInData.includes(String(predictionQuarter).trim())) {
    return { error: 'The selected quarter does not exist in the dataset.' };
  }

  const companySet = new Set(
    (Array.isArray(selectedCompanies) ? selectedCompanies : []).map((c) => String(c).trim())
  );
  // Include all quarters for the selected companies (not just the chosen prediction quarter)
  // so company profile graphs have full trend data across quarters
  const filtered = rows.filter((r) => {
    const c = String(r[companyCol] ?? '').trim();
    if (companySet.size > 0 && !companySet.has(c)) return false;
    return true;
  });

  if (filtered.length === 0) {
    return { error: 'No rows match the selected companies.' };
  }

  const basename = path.basename(originalPath);
  const filteredPath = path.join(outputsDir, `filtered_${Date.now()}_${basename}`);
  writeCsvRows(filteredPath, filtered, headers);
  return { filteredPath };
}

function summarizeCsv(filePath) {
  return new Promise((resolve, reject) => {
    let rowCount = 0;
    let highRiskCount = 0;
    let sumProb = 0;
    let maxProb = 0;

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        rowCount += 1;
        const prob = parseFloat(row.predicted_probability ?? row.predicted_Probability ?? '');
        const label = parseInt(row.predicted_label ?? row.predicted_Label ?? '', 10);

        if (!Number.isNaN(prob)) {
          sumProb += prob;
          if (prob > maxProb) {
            maxProb = prob;
          }
        }
        if (!Number.isNaN(label) && label === 1) {
          highRiskCount += 1;
        }
      })
      .on('end', () => {
        const avgProbability = rowCount > 0 ? sumProb / rowCount : 0;
        resolve({ rowCount, highRiskCount, avgProbability, maxProbability: maxProb });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

async function runScoringJob(runId, inputPath, outputPath) {
  const pythonCmd = process.env.PYTHON || 'python';
  const scriptPath = path.join(projectRoot, 'score_csv.py');

  await ScoreRun.findByIdAndUpdate(runId, { status: 'running' }).exec();

  return new Promise((resolve) => {
    // #region agent log
    fetch('http://127.0.0.1:7845/ingest/1e5d82e0-cc66-41a6-bb2e-58e1ce146270', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '8856db',
      },
      body: JSON.stringify({
        sessionId: '8856db',
        runId: String(runId),
        hypothesisId: 'H2',
        location: 'backend/src/routes/scoreRuns.js:82',
        message: 'About to spawn Python scoring process',
        data: { pythonCmd, scriptPath, projectRoot, inputPath, outputPath },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    logDebug({
      runId: String(runId),
      hypothesisId: 'H2',
      location: 'backend/src/routes/scoreRuns.js:82',
      message: 'About to spawn Python scoring process',
      data: { pythonCmd, scriptPath, projectRoot, inputPath, outputPath },
    });
    // #endregion agent log

    const proc = spawn(pythonCmd, [scriptPath, '--input', inputPath, '--output', outputPath], {
      cwd: projectRoot,
      shell: false,
    });

    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', async (err) => {
      // #region agent log
      fetch('http://127.0.0.1:7845/ingest/1e5d82e0-cc66-41a6-bb2e-58e1ce146270', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '8856db',
        },
        body: JSON.stringify({
          sessionId: '8856db',
          runId: String(runId),
          hypothesisId: 'H1',
          location: 'backend/src/routes/scoreRuns.js:101',
          message: 'Python process spawn error',
          data: { name: err.name, message: err.message },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      logDebug({
        runId: String(runId),
        hypothesisId: 'H1',
        location: 'backend/src/routes/scoreRuns.js:101',
        message: 'Python process spawn error',
        data: { name: err.name, message: err.message },
      });
      // #endregion agent log

      await ScoreRun.findByIdAndUpdate(runId, {
        status: 'failed',
        errorMessage: err.message || 'Failed to start Python scoring process',
      }).exec();
      resolve();
    });

    proc.on('close', async (code) => {
      if (code !== 0) {
        // #region agent log
        fetch('http://127.0.0.1:7845/ingest/1e5d82e0-cc66-41a6-bb2e-58e1ce146270', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': '8856db',
          },
          body: JSON.stringify({
            sessionId: '8856db',
            runId: String(runId),
            hypothesisId: 'H1',
            location: 'backend/src/routes/scoreRuns.js:120',
            message: 'Python process exited with non-zero code',
            data: { exitCode: code, stderr },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        logDebug({
          runId: String(runId),
          hypothesisId: 'H1',
          location: 'backend/src/routes/scoreRuns.js:120',
          message: 'Python process exited with non-zero code',
          data: { exitCode: code, stderr },
        });
        // #endregion agent log

        await ScoreRun.findByIdAndUpdate(runId, {
          status: 'failed',
          errorMessage: stderr || `Python scoring exited with code ${code}`,
        }).exec();
        resolve();
        return;
      }

      try {
        const summary = await summarizeCsv(outputPath);
        await ScoreRun.findByIdAndUpdate(runId, {
          status: 'completed',
          outputFilePath: outputPath,
          ...summary,
        }).exec();

        // #region agent log
        fetch('http://127.0.0.1:7845/ingest/1e5d82e0-cc66-41a6-bb2e-58e1ce146270', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': '8856db',
          },
          body: JSON.stringify({
            sessionId: '8856db',
            runId: String(runId),
            hypothesisId: 'H3',
            location: 'backend/src/routes/scoreRuns.js:148',
            message: 'Summarized scored CSV successfully',
            data: summary,
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        logDebug({
          runId: String(runId),
          hypothesisId: 'H3',
          location: 'backend/src/routes/scoreRuns.js:148',
          message: 'Summarized scored CSV successfully',
          data: summary,
        });
        // #endregion agent log
      } catch (err) {
        await ScoreRun.findByIdAndUpdate(runId, {
          status: 'failed',
          errorMessage: err.message || 'Failed to summarize scored CSV',
        }).exec();

        // #region agent log
        fetch('http://127.0.0.1:7845/ingest/1e5d82e0-cc66-41a6-bb2e-58e1ce146270', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': '8856db',
          },
          body: JSON.stringify({
            sessionId: '8856db',
            runId: String(runId),
            hypothesisId: 'H3',
            location: 'backend/src/routes/scoreRuns.js:163',
            message: 'Error while summarizing scored CSV',
            data: { name: err.name, message: err.message },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        logDebug({
          runId: String(runId),
          hypothesisId: 'H3',
          location: 'backend/src/routes/scoreRuns.js:163',
          message: 'Error while summarizing scored CSV',
          data: { name: err.name, message: err.message },
        });
        // #endregion agent log
      }
      resolve();
    });
  });
}

router.post('/api/score-runs', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'CSV file is required under field "file".' });
      return;
    }

    const fileName = req.file.originalname;
    const originalFilePath = req.file.path;
    const outputFilePath = path.join(outputsDir, `scored_${path.basename(originalFilePath)}`);

    let inputPath = originalFilePath;
    let predictionQuarter = req.body.predictionQuarter;
    let selectedCompanies = req.body.selectedCompanies;

    if (typeof selectedCompanies === 'string') {
      try {
        selectedCompanies = JSON.parse(selectedCompanies);
      } catch {
        selectedCompanies = [];
      }
    }
    if (!Array.isArray(selectedCompanies)) {
      selectedCompanies = [];
    }

    if (predictionQuarter != null && String(predictionQuarter).trim() !== '') {
      const result = await validateAndFilterCsv(
        originalFilePath,
        String(predictionQuarter).trim(),
        selectedCompanies,
        outputsDir
      );
      if (result.error) {
        res.status(400).json({ message: result.error });
        return;
      }
      inputPath = result.filteredPath;
    } else {
      predictionQuarter = undefined;
      selectedCompanies = undefined;
    }

    const runPayload = {
      fileName,
      originalFilePath,
      status: 'pending',
    };
    if (predictionQuarter != null) runPayload.predictionQuarter = predictionQuarter;
    if (selectedCompanies != null && selectedCompanies.length >= 0) runPayload.selectedCompanies = selectedCompanies;

    const run = await ScoreRun.create(runPayload);

    // #region agent log
    fetch('http://127.0.0.1:7845/ingest/1e5d82e0-cc66-41a6-bb2e-58e1ce146270', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '8856db',
      },
      body: JSON.stringify({
        sessionId: '8856db',
        runId: String(run._id),
        hypothesisId: 'H4',
        location: 'backend/src/routes/scoreRuns.js:195',
        message: 'Created ScoreRun document for new upload',
        data: { fileName, originalFilePath, outputFilePath, inputPath },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    logDebug({
      runId: String(run._id),
      hypothesisId: 'H4',
      location: 'backend/src/routes/scoreRuns.js:195',
      message: 'Created ScoreRun document for new upload',
      data: { fileName, originalFilePath, outputFilePath, inputPath },
    });
    // #endregion agent log

    runScoringJob(run._id, inputPath, outputFilePath).catch(() => {});

    res.status(201).json(run);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create score run', error: err.message });
  }
});

router.get('/api/score-runs', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 10;
    const status = req.query.status;
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (from || to) {
      query.createdAt = {};
      if (from) {
        query.createdAt.$gte = from;
      }
      if (to) {
        query.createdAt.$lte = to;
      }
    }

    const total = await ScoreRun.countDocuments(query).exec();
    const runs = await ScoreRun.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec();

    res.json({ total, page, pageSize, runs });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list score runs', error: err.message });
  }
});

router.get('/api/score-runs/:id', async (req, res) => {
  try {
    const run = await ScoreRun.findById(req.params.id).lean().exec();
    if (!run) {
      res.status(404).json({ message: 'Run not found' });
      return;
    }
    res.json(run);
  } catch (err) {
    res.status(500).json({ message: 'Failed to get score run', error: err.message });
  }
});

router.get('/api/score-runs/:id/download', async (req, res) => {
  try {
    const run = await ScoreRun.findById(req.params.id).lean().exec();
    if (!run) {
      res.status(404).json({ message: 'Run not found' });
      return;
    }
    if (!run.outputFilePath || !fs.existsSync(run.outputFilePath)) {
      res.status(400).json({ message: 'Scored file not available yet.' });
      return;
    }

    res.download(run.outputFilePath, path.basename(run.outputFilePath));
  } catch (err) {
    res.status(500).json({ message: 'Failed to download scored CSV', error: err.message });
  }
});

router.get('/api/score-runs/:id/rows', async (req, res) => {
  try {
    const run = await ScoreRun.findById(req.params.id).lean().exec();
    if (!run) {
      res.status(404).json({ message: 'Run not found' });
      return;
    }
    if (!run.outputFilePath || !fs.existsSync(run.outputFilePath)) {
      res.status(400).json({ message: 'Scored file not available yet.' });
      return;
    }

    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 25;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    const rows = [];
    let index = 0;

    fs.createReadStream(run.outputFilePath)
      .pipe(csvParser())
      .on('data', (row) => {
        if (index >= startIndex && index < endIndex) {
          rows.push(row);
        }
        index += 1;
      })
      .on('end', () => {
        res.json({
          page,
          pageSize,
          totalRows: run.rowCount ?? index,
          rows,
        });
      })
      .on('error', (err) => {
        res.status(500).json({ message: 'Failed to read scored CSV rows', error: err.message });
      });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get scored rows', error: err.message });
  }
});

router.get('/api/model-metadata', (_req, res) => {
  res.json({
    name: 'Corporate Fragility XGBoost Model',
    description:
      'Early warning model for corporate financial distress using Altman-style ratios, leverage and cash-flow features.',
    metrics: {
      rocAuc: null,
      prAuc: null,
      accuracy: null,
    },
    notes:
      'Metrics and plots can be populated from the latest training run outputs in the Python pipeline when available.',
  });
});

module.exports = router;

