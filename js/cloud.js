// Familia en línea: every device that knows the family code shares players, saved games and the
// Tablero de Directoras through Supabase (cloud-config.js). The game always plays from the local
// copy; the cloud catches up in the background and nothing waits for it, so it also works offline.

import { CLOUD } from './cloud-config.js';
import {
  profiles, setProfileMeta, addProfiles, forgetProfile, loadGameOf, writeGameOf, setSyncHook,
  familyCode, setFamilyCode,
} from './store.js';
import { summary } from './engine/ranking.js';

export const cloudAvailable = () => !!(CLOUD.url && CLOUD.key);
export const cloudOn = () => cloudAvailable() && !!familyCode();

// ---- Family code: 20 characters with no look-alikes (0/o, 1/l/i), shown in groups of 5 ----
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export function newFamilyCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
export const formatCode = (c) => (c || '').match(/.{1,5}/g)?.join('-') || '';
export function parseCode(text) {
  const raw = String(text || '').match(/#familia=([a-z0-9-]+)/i)?.[1] ?? String(text || '');
  const code = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  return code.length === 20 && [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}
export const joinLink = () => `${location.origin}${location.pathname}#familia=${formatCode(familyCode())}`;

// ---- Supabase RPC ----
async function rpc(fn, args) {
  const headers = { 'Content-Type': 'application/json', apikey: CLOUD.key };
  if (!CLOUD.key.startsWith('sb_')) headers.Authorization = `Bearer ${CLOUD.key}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(`${CLOUD.url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args), signal: ctl.signal });
    if (!res.ok) throw new Error(`${fn}: ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } finally { clearTimeout(timer); }
}

// ---- Saved games travel gzipped (about a tenth of the size) ----
function toB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function pack(s) {
  if (!s || typeof CompressionStream === 'undefined') return s;
  const stream = new Blob([JSON.stringify(s)]).stream().pipeThrough(new CompressionStream('gzip'));
  return { gz: toB64(new Uint8Array(await new Response(stream).arrayBuffer())) };
}
async function unpack(v) {
  if (!v?.gz) return v;
  const bytes = Uint8Array.from(atob(v.gz), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

const byUid = (uid) => profiles().find((p) => p.uid === uid);
const byId = (id) => profiles().find((p) => p.id === id);

// ---- Players: bring everyone in the family to this device, and this device's players to the family ----
let syncing = null;
export function syncPlayers() {
  if (!cloudOn()) return Promise.resolve(false);
  syncing ||= (async () => {
    const fam = familyCode();
    const rows = await rpc('ld_players', { fam });
    const seen = new Set();
    const fresh = [];
    for (const r of rows) {
      seen.add(r.uid);
      const p = byUid(r.uid);
      if (r.deleted) { if (p?.synced) forgetProfile(p.id); continue; }
      if (!p) fresh.push({ id: `c${r.uid}`, uid: r.uid, name: r.name, look: r.look, created: Date.now(), synced: true, ver: 0, cloudVer: r.version, sum: r.summary });
      else setProfileMeta(p.id, { name: p.dirtyProfile ? p.name : r.name, look: p.dirtyProfile ? p.look : r.look, synced: true, cloudVer: r.version, sum: r.summary });
    }
    if (fresh.length) addProfiles(fresh);
    // Players created on this device before joining (or while offline) go up now.
    for (const p of profiles()) {
      if (!seen.has(p.uid) || p.dirtyProfile) await pushProfile(p.id);
      if (!seen.has(p.uid) && loadGameOf(p.id)) await pushSave(p.id);
    }
    return true;
  })().finally(() => { syncing = null; });
  return syncing;
}

async function pushProfile(id) {
  const p = byId(id);
  if (!p || !cloudOn()) return;
  await rpc('ld_profile', { fam: familyCode(), pid: p.uid, pname: p.name, plook: p.look || {} });
  setProfileMeta(id, { synced: true, dirtyProfile: false });
}

// ---- Saved games ----
let conflictCb = () => {};
export function onConflict(fn) { conflictCb = fn; }

async function pushSave(id) {
  const p = byId(id);
  if (!p || !cloudOn()) return;
  const s = loadGameOf(id);
  const v = await rpc('ld_save', {
    fam: familyCode(), pid: p.uid, pname: p.name, plook: p.look || {},
    psave: await pack(s), psummary: summary(p, s), base: p.ver || 0,
  });
  if (v > 0) setProfileMeta(id, { ver: v, cloudVer: v, dirty: false, synced: true, sum: summary(p, s) });
  else { setProfileMeta(id, { cloudVer: -v }); if (!joining) conflictCb(id); }
}

// Before playing: if this player went further on another device, bring that game here. When both
// this device and the cloud have new progress, `choose` decides which one continues.
export async function pullSave(id, choose) {
  if (!cloudOn()) return 'offline';
  try { await syncPlayers(); } catch { return 'offline'; }
  const p = byId(id);
  if (!p || (p.cloudVer || 0) <= (p.ver || 0)) {
    if (p?.dirty) flush(id);
    return 'same';
  }
  const rows = await rpc('ld_load', { fam: familyCode(), pid: p.uid }).catch(() => null);
  if (!rows?.length) return 'offline';
  const cloud = await unpack(rows[0].save);
  const version = rows[0].version;
  const local = loadGameOf(id);
  if (p.dirty && local) {
    const keepCloud = await choose({ local, cloud });
    if (!keepCloud) { setProfileMeta(id, { ver: version, cloudVer: version }); await pushSave(id); return 'local'; }
  }
  if (cloud) writeGameOf(id, cloud);
  setProfileMeta(id, { ver: version, cloudVer: version, dirty: false, savedAt: p.sum?.t });
  return 'pulled';
}

// Saves go up a few seconds after the last change (and at once when the app goes to the background).
const timers = {};
function queue(id) {
  clearTimeout(timers[id]);
  timers[id] = setTimeout(() => flush(id), 8_000);
}
export function flush(id) {
  clearTimeout(timers[id]);
  delete timers[id];
  return pushSave(id).catch(() => { /* offline: stays dirty, goes up next time */ });
}
export function flushAll() {
  return Promise.all(profiles().filter((p) => p.dirty).map((p) => flush(p.id)));
}

setSyncHook((what, ref) => {
  if (what === 'save') { setProfileMeta(ref, { dirty: true, savedAt: Date.now() }); if (cloudOn()) queue(ref); }
  if (what === 'profile') { setProfileMeta(ref, { dirtyProfile: true }); if (cloudOn()) pushProfile(ref).catch(() => {}); }
  if (what === 'delete' && cloudOn() && ref) rpc('ld_remove', { fam: familyCode(), pid: ref }).catch(() => {});
});
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && cloudOn()) flushAll(); });
addEventListener('online', () => { if (cloudOn()) syncPlayers().then(flushAll).catch(() => {}); });

// ---- Joining and leaving ----
// sameName({ name, local, cloud }) → 'local' | 'cloud' | 'both': this device already has a player
// with the name of someone in the family (usually the same girl who played here before joining).
const norm = (n) => (n || '').trim().toLowerCase();
const freshUid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
let joining = false;
export async function joinFamily(code, sameName) {
  // Everything is asked before connecting, so closing the app halfway leaves this device as it was.
  const rows = await rpc('ld_players', { fam: code });
  const live = rows.filter((r) => !r.deleted);
  const gone = new Set(rows.filter((r) => r.deleted).map((r) => r.uid));
  const plan = [];
  for (const r of live) {
    const p = profiles().find((x) => x.uid !== r.uid && norm(x.name) === norm(r.name) && !plan.some((y) => y.p.id === x.id));
    if (!p || byUid(r.uid)) continue;
    plan.push({ p, r, pick: sameName ? await sameName({ name: r.name, local: loadGameOf(p.id), cloud: r.summary }) : 'both' });
  }
  joining = true;
  try {
    setFamilyCode(code);
    for (const p of profiles()) {
      // A player deleted from this family before comes back as someone new.
      setProfileMeta(p.id, { uid: gone.has(p.uid) ? freshUid() : p.uid, ver: 0, cloudVer: 0, dirty: !!loadGameOf(p.id), synced: false, dirtyProfile: true });
    }
    for (const { p, r, pick } of plan) {
      if (pick === 'cloud') forgetProfile(p.id);
      // Her game here replaces the family's copy: she keeps the family's identity.
      if (pick === 'local') setProfileMeta(p.id, { uid: r.uid, name: r.name, look: r.look, ver: r.version, cloudVer: r.version, synced: true, dirtyProfile: false });
    }
    await syncPlayers();
    await flushAll();
  } finally { joining = false; }
}
export function leaveFamily() {
  setFamilyCode(null);
  // Players that only came from the cloud and were never opened here go away with it.
  for (const p of profiles()) if (p.synced && !loadGameOf(p.id)) forgetProfile(p.id);
}
