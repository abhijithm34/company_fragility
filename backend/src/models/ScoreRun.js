const mongoose = require('mongoose');

const ScoreRunSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    originalFilePath: { type: String, required: true },
    outputFilePath: { type: String },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    rowCount: { type: Number },
    highRiskCount: { type: Number },
    avgProbability: { type: Number },
    maxProbability: { type: Number },
    errorMessage: { type: String },
    predictionQuarter: { type: String },
    selectedCompanies: [{ type: String }],
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

module.exports = mongoose.model('ScoreRun', ScoreRunSchema);

