require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
//const auditRoutes = require('./routes/auditRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middlewares globaux ───
app.use(cors({
  origin: 'http://localhost:5173',   // ← URL de ton Frontend !
  credentials: true,
}));
app.use(express.json());             // ← Parse le JSON du body

// ─── Routes ───
app.use('/api/auth', authRoutes);
//app.use('/api/audit', auditRoutes);

// ─── Route de test ───
app.get('/api/health', (req, res) => {
  res.json({ status: '🟢 Melonela API is running', timestamp: new Date() });
});

// ─── Gestionnaire d'erreurs global ───
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Serveur Melonela démarré sur http://localhost:${PORT}`);
});
