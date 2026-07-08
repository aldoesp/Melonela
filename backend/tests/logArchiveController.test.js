const assert = require('node:assert/strict');
const test = require('node:test');

const logArchiveService = require('../services/logArchiveService');
const { getArchivedLogs } = require('../controllers/logArchiveController');

test('getArchivedLogs returns a clear not_found response when no archive exists', async () => {
  const original = logArchiveService.findArchivedLogs;
  logArchiveService.findArchivedLogs = async () => ({
    status: 'not_found',
    message: 'Aucune archive trouvée pour cette date, ce host et ce process.',
    logs: [],
  });

  const req = {
    query: {
      host_name: 'localhost',
      process_name: 'kernel',
      date: '2026-07-08',
    },
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  try {
    await getArchivedLogs(req, res, (error) => {
      throw error;
    });

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, {
      status: 'not_found',
      message: 'Aucune archive trouvée pour cette date, ce host et ce process.',
      logs: [],
    });
  } finally {
    logArchiveService.findArchivedLogs = original;
  }
});
