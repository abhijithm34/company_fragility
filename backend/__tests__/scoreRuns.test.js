const request = require('supertest');

// Mock mongoose before requiring the app
jest.mock('mongoose', () => {
  const mMongoose = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    Schema: class Schema {
      constructor(definition, options) {
        this.definition = definition;
        this.options = options;
      }
    },
    model: jest.fn(),
  };
  return mMongoose;
});

// Mock the ScoreRun model
jest.mock('../src/models/ScoreRun', () => {
  const mockModel = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  };
  return mockModel;
});

const { app } = require('../src/server');
const ScoreRun = require('../src/models/ScoreRun');

describe('POST /api/score-runs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when no file is uploaded', async () => {
    const res = await request(app).post('/api/score-runs');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/CSV file is required/i);
  });

  it('rejects a non-CSV file upload', async () => {
    const res = await request(app)
      .post('/api/score-runs')
      .attach('file', Buffer.from('hello world'), 'test.txt');

    // multer fileFilter throws an error which Express 5 passes to the global error handler
    // The error handler returns 500 (no custom status set on the multer error)
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('message', 'Only CSV files are allowed');
  });
});

describe('GET /api/score-runs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated list of score runs', async () => {
    const mockRuns = [
      {
        _id: 'run1',
        fileName: 'test.csv',
        status: 'completed',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        _id: 'run2',
        fileName: 'test2.csv',
        status: 'pending',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ];

    const mockQuery = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockRuns),
    };

    ScoreRun.find.mockReturnValue(mockQuery);
    ScoreRun.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(2),
    });

    const res = await request(app).get('/api/score-runs');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total', 2);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('pageSize', 10);
    expect(res.body).toHaveProperty('runs');
    expect(res.body.runs).toHaveLength(2);
  });

  it('passes page and pageSize query params to the query', async () => {
    const mockQuery = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    ScoreRun.find.mockReturnValue(mockQuery);
    ScoreRun.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    const res = await request(app).get('/api/score-runs?page=2&pageSize=5');

    expect(res.status).toBe(200);
    expect(mockQuery.skip).toHaveBeenCalledWith(5); // (2-1) * 5
    expect(mockQuery.limit).toHaveBeenCalledWith(5);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(5);
  });

  it('returns 500 when database query fails', async () => {
    ScoreRun.countDocuments.mockReturnValue({
      exec: jest.fn().mockRejectedValue(new Error('DB connection lost')),
    });

    const res = await request(app).get('/api/score-runs');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('message', 'Failed to list score runs');
  });
});

describe('GET /api/score-runs/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 when run is not found', async () => {
    ScoreRun.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app).get('/api/score-runs/64a1b2c3d4e5f6a7b8c9d0e1');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message', 'Run not found');
  });

  it('returns 500 when findById throws (e.g. invalid ObjectId)', async () => {
    ScoreRun.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockRejectedValue(new Error('Cast to ObjectId failed')),
    });

    const res = await request(app).get('/api/score-runs/invalid-id');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('message', 'Failed to get score run');
  });

  it('returns the run when found', async () => {
    const mockRun = {
      _id: '64a1b2c3d4e5f6a7b8c9d0e1',
      fileName: 'data.csv',
      status: 'completed',
      rowCount: 100,
      highRiskCount: 10,
      avgProbability: 0.35,
      maxProbability: 0.92,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    ScoreRun.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockRun),
    });

    const res = await request(app).get('/api/score-runs/64a1b2c3d4e5f6a7b8c9d0e1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      _id: '64a1b2c3d4e5f6a7b8c9d0e1',
      fileName: 'data.csv',
      status: 'completed',
    });
  });
});
