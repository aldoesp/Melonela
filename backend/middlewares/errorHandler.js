// 📁 middlewares/errorHandler.js

const errorHandler = (err, req, res, next) => {
  console.error(err.stack); // Affiche l'erreur complète dans la console du serveur

  const status = err.status || 500;
  const message = status === 500 ? 'Erreur interne du serveur.' : err.message;
  res.status(status).json({ error: message });
};

module.exports = errorHandler;
