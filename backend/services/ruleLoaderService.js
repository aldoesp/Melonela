const fs = require('fs');
const path = require('path');

const interpretationRulesDir = path.join(__dirname, '..', 'rules', 'interpretation');
let cachedRules = null;

function readRulesFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error(`Fichier de règles ignoré, tableau attendu: ${filePath}`);
      return [];
    }
    return parsed;
  } catch (error) {
    console.error(`Impossible de charger les règles ${filePath}: ${error.message}`);
    return [];
  }
}

function loadInterpretationRules({ forceReload = false } = {}) {
  if (cachedRules && !forceReload) return cachedRules;

  try {
    const files = fs.readdirSync(interpretationRulesDir)
      .filter((file) => file.endsWith('.rules.json'));

    cachedRules = files
      .flatMap((file) => readRulesFile(path.join(interpretationRulesDir, file)))
      .filter((rule) => rule?.enabled !== false)
      .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));

    return cachedRules;
  } catch (error) {
    console.error(`Impossible de lire le dossier des règles: ${error.message}`);
    cachedRules = [];
    return cachedRules;
  }
}

module.exports = {
  loadInterpretationRules,
};
