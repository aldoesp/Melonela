const authService = require('../services/authService');

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const result = await authService.authenticateUser(username, password, req);

    res.json(result);

  } catch (error) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const { username, password, firstName, lastName, email } = req.body; // role retiré

    // Optionnel : Valider les entrées ici ou avec un validateur comme Joi/Zod

    const newUser = await authService.createUser(username, password, req, { firstName, lastName, email }); // role retiré de l'appel

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user: newUser
    });

  } catch (error) {
    // Gérer les erreurs potentielles (ex: username déjà pris)
    if (error.code === '23505') { // Code erreur PostgreSQL pour clé unique violée
      return res.status(409).json({ error: 'Le nom d\'utilisateur est déjà pris' });
    }
    next(error);
  }
};

module.exports = { login, register };
