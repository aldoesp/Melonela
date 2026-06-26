const userActionService = require('../services/userActionService');

const ACTION_ALLOWLIST = new Set([
  'LOGIN_SUCCESS',
  'USER_REGISTERED',
  'LOGOUT',
  'NAVIGATE',
  'VIEW_ACTION_JOURNAL',
  'GENERATE_REPORT',
  'EXPORT_REPORT',
  'REPORT_EXPORTED',
  'REPORT_DOWNLOADED',
  'CLEAR_LIVE_FEED',
  'UPDATE_SETTINGS',
  'SETTINGS_UPDATED',
  'PROFILE_UPDATE',
  'PROFILE_UPDATED',
  'SSH_KEY_ACTION',
  'PASSWORD_CHANGED',
  'SSH_KEY_ADDED',
  'SSH_KEY_DELETED',
  'USER_UPDATED',
  'USER_DELETED',
  'ROLE_UPDATED',
  'ADMIN_SECTION_VIEWED',
  'JOURNALCTL_COLLECTED',
  'JOURNALCTL_LIVE_STARTED',
  'JOURNALCTL_LIVE_STOPPED',
]);

async function listMyActions(req, res, next) {
  try {
    const actions = await userActionService.getUserActions(req.user.id, {
      limit: req.query.limit,
    });

    res.json({ actions });
  } catch (error) {
    next(error);
  }
}

async function createMyAction(req, res, next) {
  try {
    const { actionType, resource, details } = req.body;

    if (!ACTION_ALLOWLIST.has(actionType)) {
      return res.status(400).json({ error: 'Type d’action non autorisé' });
    }

    const action = await userActionService.recordUserAction({
      user: req.user,
      actionType,
      resource,
      req,
      details: details && typeof details === 'object' ? details : {},
    });

    res.status(201).json({ action });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listMyActions,
  createMyAction,
};
