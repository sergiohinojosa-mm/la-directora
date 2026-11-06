// Saved games and settings in localStorage. Each player has a profile (name + avatar look) and her
// own saved game, so several people can play on the same device. Board audios ship as files in audio/.

const OLD_SAVE_KEY = 'ladirectora.save.v1';
const PROFILES_KEY = 'ladirectora.profiles.v1';
const CURRENT_KEY = 'ladirectora.current.v1';
const SETTINGS_KEY = 'ladirectora.settings.v1';
const RIVALS_KEY = 'ladirectora.rivals.v1';
const FAMILY_KEY = 'ladirectora.family.v1';
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

// Each profile gets a random uid so the family board can tell players on different devices apart.
const newUid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
function ensureUids() {
  const list = read(PROFILES_KEY, null);
  if (list?.some((p) => !p.uid)) write(PROFILES_KEY, list.map((p) => (p.uid ? p : { ...p, uid: newUid() })));
}
ensureUids();

export const profiles = () => read(PROFILES_KEY, []);

// The cloud layer (cloud.js) listens to saves and profile changes; the store never waits for it.
let hook = () => {};
export function setSyncHook(fn) { hook = fn; }

// Sync bookkeeping on a profile (cloud version, unsent changes…), without notifying the cloud.
export function setProfileMeta(id, patch) {
  write(PROFILES_KEY, profiles().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}
export function addProfiles(list) { write(PROFILES_KEY, [...profiles(), ...list]); }
export function forgetProfile(id) {
  write(PROFILES_KEY, profiles().filter((p) => p.id !== id));
  remove(saveKey(id));
  if (currentId() === id) remove(CURRENT_KEY);
}
export const writeGameOf = (id, s) => write(saveKey(id), s);
export const currentId = () => read(CURRENT_KEY, null);
export const currentProfile = () => profiles().find((p) => p.id === currentId()) || null;
export const playerName = () => currentProfile()?.name || 'Directora';

export function selectProfile(id) { write(CURRENT_KEY, id); }

export function createProfile(name, look) {
  const list = profiles();
  const id = `p${Date.now().toString(36)}`;
  list.push({ id, uid: newUid(), name: name.trim().slice(0, 16), look, created: Date.now() });
  write(PROFILES_KEY, list);
  selectProfile(id);
  hook('profile', id);
  return id;
}

export function updateProfile(id, patch) {
  write(PROFILES_KEY, profiles().map((p) => (p.id === id ? { ...p, ...patch } : p)));
  hook('profile', id);
}

export function deleteProfile(id) {
  const uid = profiles().find((p) => p.id === id)?.uid;
  forgetProfile(id);
  hook('delete', uid);
}

export const loadGameOf = (id) => read(saveKey(id), null);

export function loadGame() {
  const id = currentId();
  return id ? read(saveKey(id), null) : null;
}

export function saveGame(s) {
  const id = currentId();
  if (!id || !write(saveKey(id), s)) return false;
  hook('save', id);
  return true;
}

export function deleteGame() {
  const id = currentId();
  if (id) { remove(saveKey(id)); hook('save', id); }
}

// Results other players sent from their own devices (Tablero de Directoras), newest per uid.
export const rivals = () => read(RIVALS_KEY, []);
export function addRivals(list) {
  const mine = new Set(profiles().map((p) => p.uid));
  const all = rivals();
  const added = [];
  for (const r of list) {
    if (!r?.u || mine.has(r.u)) continue;
    const i = all.findIndex((x) => x.u === r.u);
    if (i < 0) { all.push(r); added.push(r); } else if ((r.t || 0) > (all[i].t || 0)) { all[i] = r; added.push(r); }
  }
  write(RIVALS_KEY, all);
  return added;
}
export function removeRival(uid) { write(RIVALS_KEY, rivals().filter((r) => r.u !== uid)); }

// ?borrar=1: wipes every profile and saved game on this device.
export function wipeAll() {
  for (const p of profiles()) remove(saveKey(p.id));
  [PROFILES_KEY, CURRENT_KEY, OLD_SAVE_KEY, RIVALS_KEY, FAMILY_KEY].forEach(remove);
}

// Family code for the online board and saved games (see cloud.js). Null when not connected.
export const familyCode = () => read(FAMILY_KEY, null);
export const setFamilyCode = (code) => (code ? write(FAMILY_KEY, code) : remove(FAMILY_KEY));

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
