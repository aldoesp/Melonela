#!/usr/bin/env node
require('dotenv').config();

const pool = require('../../config/db');
const { archiveOldSystemLogs } = require('../../services/logArchiveService');

async function main() {
  const archiveAfterDays = Number.parseInt(process.env.LOG_ARCHIVE_AFTER_DAYS || '30', 10);

  try {
    const result = await archiveOldSystemLogs({
      archiveAfterDays: Number.isFinite(archiveAfterDays) ? archiveAfterDays : 30,
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
