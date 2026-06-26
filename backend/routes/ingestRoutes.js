const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/authMiddleware');
const {
  getJournalctlLiveStatus,
  startJournalctlLive,
  stopJournalctlLive,
} = require('../controllers/ingestController');

const router = express.Router();

const requireJournalctlAdmin = requireRole(['admin', 'super_admin']);

router.get('/journalctl/follow/status', authMiddleware, requireJournalctlAdmin, getJournalctlLiveStatus);
router.post('/journalctl/follow/start', authMiddleware, requireJournalctlAdmin, startJournalctlLive);
router.post('/journalctl/follow/stop', authMiddleware, requireJournalctlAdmin, stopJournalctlLive);

// Alias conservé pour ne pas casser le bouton ou les tests existants.
router.post('/journalctl/collect', authMiddleware, requireJournalctlAdmin, startJournalctlLive);

module.exports = router;
