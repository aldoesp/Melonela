const logArchiveService = require('../services/logArchiveService');

async function getArchivedLogs(req, res, next) {
  try {
    const result = await logArchiveService.findArchivedLogs(req.query);
    res.status(result.status === 'not_found' ? 404 : 200).json(result);
  } catch (error) {
    next(error);
  }
}

async function listArchiveIndex(req, res, next) {
  try {
    const archives = await logArchiveService.listArchiveIndex(req.query);
    res.json({
      status: 'success',
      source: 'archive_index',
      archives,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getArchivedLogs,
  listArchiveIndex,
};
