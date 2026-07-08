const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/authMiddleware');
const {
  getArchivedLogs,
  listArchiveIndex,
} = require('../controllers/logArchiveController');

const router = express.Router();
const requireArchiveReader = requireRole(['auditor', 'admin', 'super_admin']);

router.get('/archives/index', authMiddleware, requireArchiveReader, listArchiveIndex);
router.get('/archives', authMiddleware, requireArchiveReader, getArchivedLogs);

module.exports = router;
