const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/authMiddleware');
const {
  exportJson,
  exportCsv,
  exportPdf,
} = require('../controllers/exportController');

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole(['auditor', 'admin', 'super_admin']));

router.get('/json', exportJson);
router.get('/csv', exportCsv);
router.get('/pdf', exportPdf);

module.exports = router;
