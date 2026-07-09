const { spawn } = require('child_process');
const readline = require('readline');

let journalctlProcess = null;
let startedAt = null;
let lastError = null;
let processedCount = 0;
let rejectedCount = 0;
let syncPosition = null;

function formatJournalctlSince(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  // Evite de relire la dernière ligne déjà stockée quand on n'a pas de curseur.
  const next = new Date(date.getTime() + 1);
  return next.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

function buildJournalctlFollowArgs({ journalCursor, eventTimestamp } = {}) {
  const args = ['-f', '-o', 'json'];

  if (journalCursor) {
    return ['--after-cursor', journalCursor, ...args];
  }

  const since = eventTimestamp ? formatJournalctlSince(eventTimestamp) : null;
  if (since) {
    return ['--since', since, ...args];
  }

  const initialSince = process.env.JOURNALCTL_INITIAL_SYNC_SINCE;
  if (initialSince) {
    return ['--since', initialSince, ...args];
  }

  return args;
}

function getJournalctlStreamStatus() {
  return {
    running: Boolean(journalctlProcess),
    startedAt,
    processedCount,
    rejectedCount,
    lastError,
    syncPosition,
  };
}

function isJournalctlStreamRunning() {
  return Boolean(journalctlProcess);
}

// Lance journalctl -f -o json une seule fois et traite chaque ligne sans bloquer Express.
function startJournalctlStream({ onLog, onError, syncFrom } = {}) {
  if (journalctlProcess) {
    return {
      started: false,
      message: 'Journalctl stream already running',
      status: getJournalctlStreamStatus(),
    };
  }

  lastError = null;
  startedAt = new Date().toISOString();
  processedCount = 0;
  rejectedCount = 0;
  syncPosition = syncFrom || null;
  const args = buildJournalctlFollowArgs(syncFrom);

  try {
    journalctlProcess = spawn('journalctl', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    lastError = error.message;
    throw error;
  }

  const stdout = readline.createInterface({
    input: journalctlProcess.stdout,
    crlfDelay: Infinity,
  });

  stdout.on('line', async (line) => {
    const rawLine = line.trim();
    if (!rawLine) return;

    try {
      const rawLog = JSON.parse(rawLine);
      await onLog?.(rawLog);
      processedCount += 1;
    } catch (error) {
      rejectedCount += 1;
      lastError = error.message;
      onError?.(error);
    }
  });

  journalctlProcess.stderr.on('data', (chunk) => {
    lastError = chunk.toString().trim();
    onError?.(new Error(lastError));
  });

  journalctlProcess.on('error', (error) => {
    lastError = error.message;
    onError?.(error);
  });

  journalctlProcess.on('close', () => {
    journalctlProcess = null;
  });

  return {
    started: true,
    message: syncFrom?.journalCursor || syncFrom?.eventTimestamp
      ? 'Journalctl stream started with backlog sync'
      : 'Journalctl stream started',
    args,
    status: getJournalctlStreamStatus(),
  };
}

function stopJournalctlStream() {
  if (!journalctlProcess) {
    return {
      stopped: false,
      message: 'Journalctl stream is not running',
      status: getJournalctlStreamStatus(),
    };
  }

  journalctlProcess.kill('SIGTERM');
  journalctlProcess = null;

  return {
    stopped: true,
    message: 'Journalctl stream stopped',
    status: getJournalctlStreamStatus(),
  };
}

module.exports = {
  buildJournalctlFollowArgs,
  formatJournalctlSince,
  startJournalctlStream,
  stopJournalctlStream,
  isJournalctlStreamRunning,
  getJournalctlStreamStatus,
};
