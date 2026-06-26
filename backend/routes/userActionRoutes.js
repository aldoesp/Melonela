const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const {
  listMyActions,
  createMyAction,
} = require('../controllers/userActionController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', listMyActions);
router.post('/', createMyAction);

module.exports = router;
