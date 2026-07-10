const PDFDocument = require('pdfkit');
const auditLogService = require('./auditLogService');
const { recordUserAction } = require('./userActionService');

function escapeCsv(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toExportQuery(query) {
  return {
    ...query,
    page: 1,
    limit: query.limit || 1000,
    search: query.action || query.search || '',
    severity: query.severity || '',
    event_type: query.event_type || query.type || '',
    source_type: query.source_type || '',
    service: query.service || '',
    ui_severities: query.ui_severities || query.uiSeverities || '',
    date_from: query.date_from || query.startDate || query.debut || '',
    date_to: query.date_to || query.endDate || query.fin || '',
  };
}

async function getExportLogs(query, user) {
  const result = await auditLogService.listAuditLogs(toExportQuery(query), user);
  return result.data;
}

function buildCsv(logs) {
  const header = ['id', 'eventTimestamp', 'receivedAt', 'sourceName', 'sourceType', 'eventType', 'severity', 'message'];
  const rows = logs.map((log) => [
    log.id,
    log.eventTimestamp,
    log.receivedAt,
    log.sourceName,
    log.sourceType,
    log.eventType,
    log.severity,
    log.message,
  ].map(escapeCsv).join(','));

  return [header.join(','), ...rows].join('\n');
}

function buildPdfBuffer(logs, query) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 42, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc
      .fontSize(20)
      .fillColor('#0f172a')
      .text('Melonela', { continued: true })
      .fillColor('#2563eb')
      .text(' Audit Report');

    doc.moveDown(0.6);
    doc.fontSize(10).fillColor('#475569');
    doc.text(`Période: ${query.startDate || 'début'} -> ${query.endDate || 'maintenant'}`);
    doc.text(`Filtres: type=${query.event_type || query.type || 'tous'} source=${query.source_type || 'toutes'} recherche=${query.action || query.search || 'aucune'}`);

    const byType = logs.reduce((acc, log) => {
      acc[log.eventType] = (acc[log.eventType] || 0) + 1;
      return acc;
    }, {});

    doc.moveDown();
    doc.fontSize(13).fillColor('#0f172a').text('Statistiques');
    doc.fontSize(10).fillColor('#334155').text(`Total événements: ${logs.length}`);
    Object.entries(byType).slice(0, 8).forEach(([type, count]) => {
      doc.text(`${type}: ${count}`);
    });

    doc.moveDown();
    doc.fontSize(13).fillColor('#0f172a').text('Événements');
    doc.moveDown(0.3);

    logs.slice(0, 40).forEach((log) => {
      doc
        .fontSize(8)
        .fillColor('#111827')
        .text(`#${log.id} ${new Date(log.eventTimestamp).toLocaleString('fr-FR')} | ${log.sourceName} | ${log.eventType} | ${log.severity}`);
      doc.fillColor('#64748b').text(`Source: ${log.sourceType} | Message: ${log.message}`);
      doc.moveDown(0.25);
    });

    if (logs.length > 40) {
      doc.moveDown().fillColor('#64748b').text(`${logs.length - 40} événement(s) supplémentaire(s) non affiché(s) dans l'aperçu PDF.`);
    }

    doc.end();
  });
}

async function auditExport(user, req, format, count) {
  try {
    await recordUserAction({
      user,
      actionType: format === 'DOWNLOAD' ? 'REPORT_DOWNLOADED' : 'REPORT_EXPORTED',
      resource: `Export ${format}`,
      req,
      details: { format, count },
    });
  } catch (error) {
    console.warn('Export audit log skipped:', error.message);
  }
}

module.exports = {
  getExportLogs,
  buildCsv,
  buildPdfBuffer,
  auditExport,
};
