const profileService = require('../services/profileService');

async function getProfile(req, res, next) {
  try {
    const profile = await profileService.getProfile(req.user.id);
    res.json({ profile });
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const profile = await profileService.updateProfile(req.user, req.body, req);
    res.json({ profile });
  } catch (error) {
    next(error);
  }
}

async function updatePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Mot de passe invalide' });
    }

    await profileService.updatePassword(req.user, { currentPassword, newPassword }, req);
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  updatePassword,
};
