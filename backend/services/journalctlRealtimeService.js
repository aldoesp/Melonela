const { spawn } = require('child_process');
const readline = require('readline');

let journalctlProcess = null;
let startedAt = null;
let lastError = null;
let processedCount = 0;
let rejectedCount = 0;

function getJournalctlStreamStatus() {
  return {
    running: Boolean(journalctlProcess),
    startedAt,
    processedCount,
    rejectedCount,
    lastError,
  };
}

function isJournalctlStreamRunning() {
  return Boolean(journalctlProcess);
}

// Lance journalctl -f -o json une seule fois et traite chaque ligne sans bloquer Express.
function startJournalctlStream({ onLog, onError } = {}) {
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

  try {
    journalctlProcess = spawn('journalctl', ['-f', '-o', 'json'], {
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
    message: 'Journalctl stream started',
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
  startJournalctlStream,
  stopJournalctlStream,
  isJournalctlStreamRunning,
  getJournalctlStreamStatus,
};
