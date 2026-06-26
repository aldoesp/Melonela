const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const {
  getProfile,
  updateProfile,
  updatePassword,
} = require('../controllers/profileController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getProfile);
router.put('/', updateProfile);
router.put('/password', updatePassword);

module.exports = router;
