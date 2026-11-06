// Saved game and settings in localStorage. Board audios ship as files in audio/ (see audio/audios.js).

const SAVE_KEY = 'ladirectora.save.v1';
const SETTINGS_KEY = 'ladirectora.settings.v1';
// The family's PIN for the Panel del Consejo. Luciana plays without it.
const DEFAULT_PIN = '8642';

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGame(s) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function deleteGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage blocked */ }
}

export function loadSettings() {
  try {
    return { sound: true, pin: DEFAULT_PIN, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { sound: true, pin: DEFAULT_PIN };
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage blocked */ }
}

