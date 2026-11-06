// Saved games and settings in localStorage. Each player has a profile (name + avatar look) and her
// own saved game, so several people can play on the same device. Board audios ship as files in audio/.

const OLD_SAVE_KEY = 'ladirectora.save.v1';
const PROFILES_KEY = 'ladirectora.profiles.v1';
const CURRENT_KEY = 'ladirectora.current.v1';
const SETTINGS_KEY = 'ladirectora.settings.v1';
const saveKey = (id) => `ladirectora.save.${id}`;

const read = (key, fallback) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
};
const remove = (key) => { try { localStorage.removeItem(key); } catch { /* storage blocked */ } };

// The game started with a single save: it becomes Luciana's profile.
function migrate() {
  const old = read(OLD_SAVE_KEY, null);
  if (!old || read(PROFILES_KEY, null)) return;
  write(PROFILES_KEY, [{ id: 'p1', name: 'Luciana', look: { preset: 'luciana' }, created: Date.now() }]);
  write(saveKey('p1'), old);
  write(CURRENT_KEY, 'p1');
  remove(OLD_SAVE_KEY);
}
migrate();

export const profiles = () => read(PROFILES_KEY, []);
export const currentId = () => read(CURRENT_KEY, null);
export const currentProfile = () => profiles().find((p) => p.id === currentId()) || null;
export const playerName = () => currentProfile()?.name || 'Directora';

export function selectProfile(id) { write(CURRENT_KEY, id); }

export function createProfile(name, look) {
  const list = profiles();
  const id = `p${Date.now().toString(36)}`;
  list.push({ id, name: name.trim().slice(0, 16), look, created: Date.now() });
  write(PROFILES_KEY, list);
  selectProfile(id);
  return id;
}

export function updateProfile(id, patch) {
  write(PROFILES_KEY, profiles().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export function deleteProfile(id) {
  write(PROFILES_KEY, profiles().filter((p) => p.id !== id));
  remove(saveKey(id));
  if (currentId() === id) remove(CURRENT_KEY);
}

export const loadGameOf = (id) => read(saveKey(id), null);

export function loadGame() {
  const id = currentId();
  return id ? read(saveKey(id), null) : null;
}

export function saveGame(s) {
  const id = currentId();
  return id ? write(saveKey(id), s) : false;
}

export function deleteGame() {
  const id = currentId();
  if (id) remove(saveKey(id));
}

// ?borrar=1: wipes every profile and saved game on this device.
export function wipeAll() {
  for (const p of profiles()) remove(saveKey(p.id));
  [PROFILES_KEY, CURRENT_KEY, OLD_SAVE_KEY].forEach(remove);
}

export function loadSettings() {
  try {
    return { sound: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { sound: true };
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage blocked */ }
}
