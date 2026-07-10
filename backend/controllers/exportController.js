const exportService = require('../services/exportService');

function safeFilename(value, fallback) {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return raw
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || fallback;
}

async function exportJson(req, res, next) {
  try {
    const logs = await exportService.getExportLogs(req.query, req.user);
    await exportService.auditExport(req.user, req, 'JSON', logs.length);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(req.query.filename, 'melonela-audit')}.json"`);
    res.json({ data: logs, exportedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
}

async function exportCsv(req, res, next) {
  try {
    const logs = await exportService.getExportLogs(req.query, req.user);
    const csv = exportService.buildCsv(logs);
    await exportService.auditExport(req.user, req, 'CSV', logs.length);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(req.query.filename, 'melonela-audit')}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

async function exportPdf(req, res, next) {
  try {
    const logs = await exportService.getExportLogs(req.query, req.user);
    const pdf = await exportService.buildPdfBuffer(logs, req.query);
    await exportService.auditExport(req.user, req, 'PDF', logs.length);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(req.query.filename, 'melonela-audit')}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  exportJson,
  exportCsv,
  exportPdf,
};
