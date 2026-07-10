const auditLogService = require('../services/auditLogService');

async function listAuditLogs(req, res, next) {
  try {
    const result = await auditLogService.listAuditLogs(req.query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getHourlyAuditLogStats(req, res, next) {
  try {
    const result = await auditLogService.getHourlyAuditLogStats(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHourlyAuditLogStats,
  listAuditLogs,
};
