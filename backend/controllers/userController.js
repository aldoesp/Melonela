const userService = require('../services/userService');

async function listUsers(req, res, next) {
  try {
    const result = await userService.listUsers(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getUser(req, res, next) {
  try {
    const user = await userService.getUser(req.params.id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await userService.updateUser(req.user, req.params.id, req.body, req);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    await userService.deleteUser(req.user, req.params.id, req);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listUsers,
  getUser,
  updateUser,
  deleteUser,
};
