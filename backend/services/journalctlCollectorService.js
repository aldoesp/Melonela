const realtime = require('./journalctlRealtimeService');

module.exports = {
  startJournalctlFollow: realtime.startJournalctlStream,
  stopJournalctlFollow: realtime.stopJournalctlStream,
  getJournalctlFollowStatus: realtime.getJournalctlStreamStatus,
};
