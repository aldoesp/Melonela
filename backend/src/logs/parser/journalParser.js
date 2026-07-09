const FRENCH_MONTHS = {
  'janv.': 0,
  janv: 0,
  'févr.': 1,
  févr: 1,
  'fevr.': 1,
  fevr: 1,
  mars: 2,
  'avr.': 3,
  avr: 3,
  mai: 4,
  juin: 5,
  'juil.': 6,
  juil: 6,
  'août': 7,
  aout: 7,
  'sept.': 8,
  sept: 8,
  'oct.': 9,
  oct: 9,
  'nov.': 10,
  nov: 10,
  'déc.': 11,
  déc: 11,
  'dec.': 11,
  dec: 11,
};

function getCurrentYear(options = {}) {
  if (options.year) return Number(options.year);
  if (options.now) return new Date(options.now).getFullYear();
  return new Date().getFullYear();
}

function normalizeMonth(month) {
  return String(month || '').trim().toLowerCase();
}

function buildTimestamp({ month, day, time, year }) {
  const monthIndex = FRENCH_MONTHS[normalizeMonth(month)];
  if (monthIndex === undefined) return null;

  const [hour, minute, second] = time.split(':').map((part) => Number.parseInt(part, 10));
  const timestamp = new Date(Date.UTC(year, monthIndex, Number(day), hour, minute, second));

  if (Number.isNaN(timestamp.getTime())) return null;
  return timestamp.toISOString();
}

function parseJournalLog(rawLine, options = {}) {
  const line = String(rawLine || '').trim();
  const year = getCurrentYear(options);
  const pattern = /^(?<month>\S+)\s+(?<day>\d{1,2})\s+(?<time>\d{2}:\d{2}:\d{2})\s+(?<host>\S+)\s+(?<process>[^\s:[\]]+)(?:\[(?<pid>\d+)\])?:\s*(?<message>.*)$/u;
  const match = line.match(pattern);

  if (!match?.groups) {
    return {
      event_timestamp: new Date(options.now || Date.now()).toISOString(),
      host_name: options.hostName || null,
      process_name: 'unknown',
      process_id: null,
      message: line,
      parser_status: 'failed',
      parser_error: 'unrecognized_journalctl_format',
    };
  }

  const eventTimestamp = buildTimestamp({
    month: match.groups.month,
    day: match.groups.day,
    time: match.groups.time,
    year,
  });

  return {
    event_timestamp: eventTimestamp || new Date(options.now || Date.now()).toISOString(),
    host_name: match.groups.host,
    process_name: match.groups.process || 'unknown',
    process_id: match.groups.pid || null,
    message: match.groups.message || '',
    parser_status: eventTimestamp ? 'success' : 'partial',
    parser_error: eventTimestamp ? null : 'invalid_or_unsupported_month',
  };
}

module.exports = {
  FRENCH_MONTHS,
  parseJournalLog,
};
