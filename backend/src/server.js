const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const scoreRunsRouter = require('./routes/scoreRuns');
const companiesRouter = require('./routes/companies');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fragility_dashboard';

app.use(
  cors({
    origin: '*',
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'fragility-dashboard-backend',
    timestamp: new Date().toISOString(),
  });
});

app.use(scoreRunsRouter);
app.use(companiesRouter);

async function start() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    app.listen(port, () => {
      console.log(`Backend listening on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
