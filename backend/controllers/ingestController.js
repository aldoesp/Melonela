const {
  getJournalctlFollowStatus,
  startJournalctlFollow,
  stopJournalctlFollow,
} = require('../services/journalctlCollectorService');
const { normalizeJournalctlLog } = require('../services/logNormalizerService');
const { validateMelonelaLog } = require('../services/schemaValidationService');
const { insertSystemEventLog } = require('../services/auditLogService');
const { recordUserAction } = require('../services/userActionService');

async function persistJournalctlLog(rawLog) {
  const normalized = normalizeJournalctlLog(rawLog);
  const validation = validateMelonelaLog(normalized);

  if (!validation.valid) {
    const error = new Error(`Log journalctl rejeté: ${validation.errors.join(', ')}`);
    error.validationErrors = validation.errors;
    throw error;
  }

  return insertSystemEventLog(normalized);
}

async function startJournalctlLive(req, res, next) {
  try {
    const result = startJournalctlFollow({
      onLog: persistJournalctlLog,
      onError: (error) => {
        console.error('Erreur journalctl -f:', error.message);
      },
    });

    await recordUserAction({
      user: req.user,
      actionType: 'JOURNALCTL_LIVE_STARTED',
      resource: 'system_event_logs',
      req,
      details: result.status,
    });

    res.status(result.started ? 201 : 200).json({
      message: result.started
        ? 'Suivi journalctl -f démarré'
        : 'Suivi journalctl -f déjà actif',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

async function stopJournalctlLive(req, res, next) {
  try {
    const result = stopJournalctlFollow();

    await recordUserAction({
      user: req.user,
      actionType: 'JOURNALCTL_LIVE_STOPPED',
      resource: 'system_event_logs',
      req,
      details: result.status,
    });

    res.json({
      message: result.stopped
        ? 'Suivi journalctl -f arrêté'
        : 'Aucun suivi journalctl -f actif',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

function getJournalctlLiveStatus(req, res) {
  res.json(getJournalctlFollowStatus());
}

module.exports = {
  startJournalctlLive,
  stopJournalctlLive,
  getJournalctlLiveStatus,
};
