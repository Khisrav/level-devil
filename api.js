/* ============================================================
   Shared Supabase API + session helpers (used by all pages).
   The publishable key is safe to ship: tables are locked by RLS
   and everything goes through the RPC functions below.
   ============================================================ */
"use strict";

const API = (() => {
  const URL_BASE = "https://fedtvjkokephaosvsovu.supabase.co/rest/v1/rpc/";
  const KEY = "sb_publishable_wrRZrv8Ln8mdRRyytHhNWA_LUfH2HAL";
  const TOKEN_KEY = "cb_token";
  const PLAYER_KEY = "cb_player";
  const TOTAL_LEVELS = 30;

  async function rpc(fn, args = {}) {
    const res = await fetch(URL_BASE + fn, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error("http_" + res.status);
    return res.json();
  }

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  function token() { return store.get(TOKEN_KEY); }
  function cachedPlayer() {
    try { return JSON.parse(store.get(PLAYER_KEY)) || null; } catch { return null; }
  }
  function saveSession(tok, player) {
    if (tok) store.set(TOKEN_KEY, tok);
    if (player) store.set(PLAYER_KEY, JSON.stringify(player));
  }
  function clearSession() { store.del(TOKEN_KEY); store.del(PLAYER_KEY); }

  // Returns the player for the stored token, null if the session is invalid,
  // or the cached player if the network is down (so a flaky Wi-Fi doesn't log you out).
  async function me() {
    const t = token();
    if (!t) return null;
    try {
      const r = await rpc("me", { p_token: t });
      if (r.error) { clearSession(); return null; }
      saveSession(null, r.player);
      return r.player;
    } catch {
      return cachedPlayer();
    }
  }

  async function register(name, pin, seed, realName) {
    const r = await rpc("register", { p_name: name, p_pin: pin, p_avatar_seed: seed, p_real_name: realName });
    if (!r.error) saveSession(r.token, r.player);
    return r;
  }
  async function login(name, pin) {
    const r = await rpc("login", { p_name: name, p_pin: pin });
    if (!r.error) saveSession(r.token, r.player);
    return r;
  }
  async function logout() {
    const t = token();
    clearSession();
    if (t) { try { await rpc("logout", { p_token: t }); } catch {} }
  }

  // Progress calls go through one serial queue, so deaths for a level always
  // land before that level's completion, and failed calls are retried.
  let queue = Promise.resolve();
  function enqueue(fn, args) {
    const run = async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const r = await rpc(fn, { p_token: token(), ...args });
          if (r && r.player) saveSession(null, r.player);
          return r;
        } catch {
          await new Promise((ok) => setTimeout(ok, 800 * (attempt + 1)));
        }
      }
      return null;
    };
    queue = queue.then(run, run);
    return queue;
  }
  const reportDeaths = (level, count) => enqueue("report_deaths", { p_level: level, p_count: count });
  const completeLevel = (level) => enqueue("complete_level", { p_level: level });

  const leaderboard = (limit = 50) => rpc("get_leaderboard", { p_limit: limit });

  function avatarUrl(seed) {
    return "https://api.dicebear.com/9.x/fun-emoji/svg?seed=" + encodeURIComponent(seed || "x");
  }
  function randomSeed() {
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return a[0].toString(36) + a[1].toString(36);
  }

  return {
    TOTAL_LEVELS, token, cachedPlayer, me, register, login, logout,
    reportDeaths, completeLevel, leaderboard, avatarUrl, randomSeed,
  };
})();
