// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { login, register } = require('../controllers/authController');

// POST /api/auth/register - Créer un nouvel utilisateur
router.post('/register', register);

// POST /api/auth/login - Authentifier un utilisateur
router.post('/login', login);

module.exports = router;