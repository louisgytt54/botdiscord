// ============================================================================
// utils/storage.js — petite persistance JSON locale (pas besoin de base de
// données pour démarrer). Stocke les avertissements et le compteur de tickets.
// Pourra être remplacé plus tard par Supabase si besoin.
// ============================================================================

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const WARNINGS_FILE = path.join(DATA_DIR, "warnings.json");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");

function ensureFile(file, defaultValue) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
  }
}

function readJSON(file, defaultValue) {
  ensureFile(file, defaultValue);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return defaultValue;
  }
}

function writeJSON(file, data) {
  ensureFile(file, data);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---- Warnings -----------------------------------------------------------
function getWarnings(userId) {
  const all = readJSON(WARNINGS_FILE, {});
  return all[userId] || [];
}

function addWarning(userId, warning) {
  const all = readJSON(WARNINGS_FILE, {});
  if (!all[userId]) all[userId] = [];
  all[userId].push(warning);
  writeJSON(WARNINGS_FILE, all);
  return all[userId];
}

function clearWarnings(userId) {
  const all = readJSON(WARNINGS_FILE, {});
  delete all[userId];
  writeJSON(WARNINGS_FILE, all);
}

// ---- Tickets --------------------------------------------------------------
function nextTicketNumber() {
  const all = readJSON(TICKETS_FILE, { count: 0 });
  all.count += 1;
  writeJSON(TICKETS_FILE, all);
  return all.count;
}

module.exports = {
  getWarnings,
  addWarning,
  clearWarnings,
  nextTicketNumber,
};
