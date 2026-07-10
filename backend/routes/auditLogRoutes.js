const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/authMiddleware');
const { getHourlyAuditLogStats, listAuditLogs } = require('../controllers/auditLogController');

const router = express.Router();

router.get('/stats/hourly', authMiddleware, requireRole(['auditor', 'admin', 'super_admin']), getHourlyAuditLogStats);
router.get('/', authMiddleware, requireRole(['auditor', 'admin', 'super_admin']), listAuditLogs);

module.exports = router;
