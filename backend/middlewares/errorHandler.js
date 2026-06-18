// 📁 middlewares/errorHandler.js

const errorHandler = (err, req, res, next) => {
  console.error(err.stack); // Affiche l'erreur complète dans la console du serveur

  // Répondre avec une erreur 500 générique
  res.status(500).json({ error: 'Erreur interne du serveur.' });
};

module.exports = errorHandler;