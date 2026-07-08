const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  buildArchivePath,
  buildLogArchiveIndexQuery,
  exportLogsToJsonl,
  resolveArchiveOutputPath,
} = require('../services/logArchiveService');
const { readCompressedJsonlLogs } = require('../services/compressedLogReader');

test('buildArchivePath creates the expected cold storage path', () => {
  const archivePath = buildArchivePath({
    archiveRoot: '/var/lib/melonela_logs',
    hostName: 'localhost',
    year: 2026,
    month: 7,
    week: 28,
    day: 8,
    processName: 'NetworkManager',
  });

  assert.equal(
    archivePath,
    '/var/lib/melonela_logs/hosts/localhost/year=2026/month=07/week=28/day=08/NetworkManager.jsonl.zst'
  );
});

test('exportLogsToJsonl writes one JSON object per line', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'melonela-jsonl-'));
  const outputPath = path.join(tmpDir, 'kernel.jsonl');

  await exportLogsToJsonl([
    {
      id: 1,
      source_name: 'journalctl',
      source_type: 'system',
      process_name: 'kernel',
      host_name: 'localhost',
      event_type: 'system_event',
      severity: 'low',
      message: 'first log',
      raw_payload: { parser: 'journalParser' },
      normalized_payload: { process_name: 'kernel' },
      event_timestamp: '2026-07-08T00:00:00.000Z',
    },
    {
      id: 2,
      source_name: 'journalctl',
      source_type: 'system',
      process_name: 'kernel',
      host_name: 'localhost',
      event_type: 'system_error',
      severity: 'medium',
      message: 'second log',
      raw_payload: {},
      normalized_payload: {},
      event_timestamp: '2026-07-08T00:01:00.000Z',
    },
  ], outputPath);

  const lines = (await fs.readFile(outputPath, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).message, 'first log');
  assert.equal(JSON.parse(lines[1]).severity, 'medium');

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('resolveArchiveOutputPath does not overwrite an existing archive', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'melonela-collision-'));
  const outputPath = path.join(tmpDir, 'kernel.jsonl.zst');
  await fs.writeFile(outputPath, 'already indexed');

  const resolved = await resolveArchiveOutputPath(outputPath);

  assert.notEqual(resolved, outputPath);
  assert.match(path.basename(resolved), /^kernel-\d{14}-1\.jsonl\.zst$/);

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('readCompressedJsonlLogs streams and filters a zstd JSONL archive', {
  skip: spawnSync('zstd', ['--version']).status !== 0 ? 'zstd is not installed' : false,
}, async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'melonela-zstd-'));
  const jsonlPath = path.join(tmpDir, 'logs.jsonl');
  const zstPath = `${jsonlPath}.zst`;

  await fs.writeFile(jsonlPath, [
    JSON.stringify({ severity: 'low', event_type: 'system_event', category: 'System', message: 'hello' }),
    JSON.stringify({ severity: 'high', event_type: 'ssh_failed', category: 'Authentication', message: 'Failed password' }),
    JSON.stringify({ severity: 'medium', event_type: 'network_event', category: 'Network', message: 'connected' }),
  ].join('\n'));

  execFileSync('zstd', ['-f', '-q', '-o', zstPath, jsonlPath]);

  const logs = await readCompressedJsonlLogs(zstPath, {
    severity: 'high',
    search: 'password',
    limit: 10,
  });

  assert.equal(logs.length, 1);
  assert.equal(logs[0].event_type, 'ssh_failed');

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('buildLogArchiveIndexQuery targets log_archives filters', () => {
  const query = buildLogArchiveIndexQuery({
    host_name: 'localhost',
    process_name: 'kernel',
    year: '2026',
    month: '7',
    day: '8',
    archive_status: 'available',
  });

  assert.equal(
    query.clause,
    'WHERE host_name = $1 AND process_name = $2 AND archive_status = $3 AND year = $4 AND month = $5 AND day = $6'
  );
  assert.deepEqual(query.values, ['localhost', 'kernel', 'available', 2026, 7, 8]);
});
