let ioInstance = null;

function setSocketServer(io) {
  ioInstance = io;
}

function emitAuditLogCreated(log) {
  if (!ioInstance || !log) return;
  ioInstance.emit('audit-log-created', log);
}

function emitSystemEventCreated(log) {
  if (!ioInstance || !log) return;
  ioInstance.emit('system_event_created', log);
}

module.exports = {
  setSocketServer,
  emitAuditLogCreated,
  emitSystemEventCreated,
};
