require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const authRoutes = require('./routes/authRoutes');
const userActionRoutes = require('./routes/userActionRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const profileRoutes = require('./routes/profileRoutes');
const userRoutes = require('./routes/userRoutes');
const exportRoutes = require('./routes/exportRoutes');
const ingestRoutes = require('./routes/ingestRoutes');
const logArchiveRoutes = require('./routes/logArchiveRoutes');
const { ensureUserActionTable } = require('./services/userActionService');
const { ensureSystemEventLogTable } = require('./services/auditLogService');
const { ensureLogArchiveTable } = require('./services/logArchiveService');
const { ensureUserSchema } = require('./services/schemaService');
const { setSocketServer } = require('./realtime/socket');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

setSocketServer(io);

// ─── Middlewares globaux ───
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origine non autorisée par CORS: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());             // ← Parse le JSON du body

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/user-actions', userActionRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/logs', logArchiveRoutes);

// ─── Route de test ───
app.get('/api/health', (req, res) => {
  res.json({ status: '🟢 Melonela API is running', timestamp: new Date() });
});

// ─── Gestionnaire d'erreurs global ───
app.use(errorHandler);

Promise.all([
  ensureUserSchema(),
  ensureUserActionTable(),
  ensureSystemEventLogTable(),
  ensureLogArchiveTable(),
])
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Serveur Melonela démarré sur http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Impossible de préparer les tables Melonela:', error);
    process.exit(1);
  });
