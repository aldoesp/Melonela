const {
  getJournalctlStreamStatus,
  startJournalctlStream,
  stopJournalctlStream,
} = require('../services/journalctlRealtimeService');
const { parseJournalctlLog } = require('../services/parserFactory');
const { validateMelonelaLog } = require('../services/schemaValidationService');
const eventInterpretationEngine = require('../services/eventInterpretationEngine');
const { insertSystemEventLog } = require('../services/auditLogService');
const { recordUserAction } = require('../services/userActionService');

async function persistJournalctlLog(rawLog) {
  const normalized = parseJournalctlLog(rawLog);
  const validation = validateMelonelaLog(normalized);

  if (!validation.valid) {
    const error = new Error(`Log journalctl rejeté: ${validation.errors.join(', ')}`);
    error.validationErrors = validation.errors;
    throw error;
  }

  const interpreted = eventInterpretationEngine.interpret(normalized);
  return insertSystemEventLog(interpreted);
}

async function startJournalctlLive(req, res, next) {
  try {
    const result = startJournalctlStream({
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
      message: result.started ? 'Suivi journalctl -f démarré' : result.message,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

async function stopJournalctlLive(req, res, next) {
  try {
    const result = stopJournalctlStream();

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
  res.json(getJournalctlStreamStatus());
}

module.exports = {
  startJournalctlLive,
  stopJournalctlLive,
  getJournalctlLiveStatus,
};
