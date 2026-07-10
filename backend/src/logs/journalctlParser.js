const MONTHS_FR = {
  'janv.': '01',
  'févr.': '02',
  mars: '03',
  'avr.': '04',
  mai: '05',
  juin: '06',
  'juil.': '07',
  août: '08',
  'sept.': '09',
  'oct.': '10',
  'nov.': '11',
  'déc.': '12',
};

function parseJournalctlLine(rawLine, options = {}) {
  const year = options.year || new Date(options.now || Date.now()).getFullYear();
  const line = String(rawLine || '').trim();
  const regex = /^(?<month>\S+)\s+(?<day>\d{1,2})\s+(?<time>\d{2}:\d{2}:\d{2})\s+(?<host>\S+)\s+(?<process>[^\[:]+)(?:\[(?<pid>\d+)\])?:\s+(?<message>.*)$/u;
  const match = line.match(regex);

  if (!match?.groups) {
    return {
      parsed: false,
      rawLine: line,
      message: line,
    };
  }

  const {
    month,
    day,
    time,
    host,
    process,
    pid,
    message,
  } = match.groups;
  const monthNumber = MONTHS_FR[month] || null;
  const timestamp = monthNumber
    ? `${year}-${monthNumber}-${String(day).padStart(2, '0')}T${time}`
    : null;

  return {
    parsed: true,
    rawLine: line,
    timestamp,
    event_timestamp: timestamp ? `${timestamp}.000Z` : new Date(options.now || Date.now()).toISOString(),
    host_name: host,
    process_name: process,
    process_id: pid || null,
    service: process,
    message,
  };
}

function parseNetworkManagerMessage(message) {
  const regex = /^<(?<level>\w+)>\s+\[(?<nm_time>[0-9.]+)\]\s+(?<body>.*)$/u;
  const match = String(message || '').trim().match(regex);

  if (!match?.groups) {
    return {
      nm_level: null,
      nm_monotonic_time: null,
      cleaned_message: String(message || '').trim(),
    };
  }

  return {
    nm_level: match.groups.level,
    nm_monotonic_time: Number(match.groups.nm_time),
    cleaned_message: match.groups.body.trim(),
  };
}

module.exports = {
  MONTHS_FR,
  parseJournalctlLine,
  parseNetworkManagerMessage,
};
