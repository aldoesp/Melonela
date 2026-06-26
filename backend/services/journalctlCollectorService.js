const { spawn } = require('child_process');
const readline = require('readline');

let journalctlProcess = null;
let startedAt = null;
let lastError = null;
let processedCount = 0;
let rejectedCount = 0;

function getJournalctlFollowStatus() {
  return {
    running: Boolean(journalctlProcess),
    startedAt,
    processedCount,
    rejectedCount,
    lastError,
  };
}

// Lance un flux journalctl permanent. Chaque nouvelle ligne JSON est passée au callback onLog.
function startJournalctlFollow({ onLog, onError } = {}) {
  if (journalctlProcess) {
    return {
      started: false,
      status: getJournalctlFollowStatus(),
    };
  }

  lastError = null;
  startedAt = new Date().toISOString();
  processedCount = 0;
  rejectedCount = 0;

  journalctlProcess = spawn('journalctl', ['-f', '--no-pager', '-o', 'json'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

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
    lastError = chunk.toString();
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
    status: getJournalctlFollowStatus(),
  };
}

function stopJournalctlFollow() {
  if (!journalctlProcess) {
    return {
      stopped: false,
      status: getJournalctlFollowStatus(),
    };
  }

  journalctlProcess.kill('SIGTERM');
  journalctlProcess = null;

  return {
    stopped: true,
    status: getJournalctlFollowStatus(),
  };
}

module.exports = {
  startJournalctlFollow,
  stopJournalctlFollow,
  getJournalctlFollowStatus,
};
