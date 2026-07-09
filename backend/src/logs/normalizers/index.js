const { normalizeKernel } = require('./kernel.normalizer');
const { normalizeNetworkManager } = require('./NetworkManager.normalizer');
const { normalizeUnknown } = require('./unknown.normalizer');
const { normalizeWpaSupplicant } = require('./wpa_supplicant.normalizer');

const NORMALIZERS = {
  NetworkManager: normalizeNetworkManager,
  wpa_supplicant: normalizeWpaSupplicant,
  kernel: normalizeKernel,
  unknown: normalizeUnknown,
};

function normalizeParsedLog(parsedLog) {
  const processName = parsedLog.process_name || 'unknown';
  const normalizer = NORMALIZERS[processName] || NORMALIZERS.unknown;
  const normalized = normalizer(parsedLog);

  return normalized || normalizeUnknown(parsedLog);
}

module.exports = {
  NORMALIZERS,
  normalizeParsedLog,
};
