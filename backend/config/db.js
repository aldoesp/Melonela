// Création d'une connexion à la base de données PostgreSQL en utilisant le module 'pg' et les variables d'environnement pour la configuration.
const {Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

pool.on('connect', () => {
  console.log('Connexion à la base de données PostgreSQL réussie.');
});

pool.on('error', (err) => {
  console.error('Erreur de connexion à la base de données PostgreSQL:', err);
  process.exit(-1); // Quitte le processus en cas d'erreur de connexion
});

module.exports = pool; // Exporte le pool de connexions pour l'utiliser dans d'autres parties de l'application