"use strict";

/* ===== Config: edit moods and search keywords here ===== */
const MOODS = {
  happy:     { e:"😄", queries:["happy hits","feel good bollywood","party hits"],
               words:["happy","great","good","joy","glad","cheerful","awesome"] },
  sad:       { e:"😢", queries:["sad songs","heartbreak songs","sad lofi"],
               words:["sad","down","cry","lonely","heartbroken","depressed","low","upset"] },
  angry:     { e:"😠", queries:["intense rock","rage workout","angry songs"],
               words:["angry","mad","furious","annoyed","irritated","frustrated"] },
  calm:      { e:"😌", queries:["peaceful piano","relaxing instrumental","calm vibes"],
               words:["calm","relaxed","peace","peaceful","chill","relax"] },
  excited:   { e:"🤩", queries:["dance hits","upbeat pop","trending now"],
               words:["excited","pumped","thrilled","party","hyped"] },
  focus:     { e:"🎯", queries:["focus music","lofi study","deep focus"],
               words:["focus","study","work","exam","concentrate","coding","assignment"] },
  romantic:  { e:"❤️", queries:["romantic songs","love songs","romantic hits"],
               words:["love","romantic","crush","date","in love"] },
  tired:     { e:"😴", queries:["sleep music","soft acoustic","chill lofi"],
               words:["tired","sleepy","exhausted","sleep","drained"] },
  motivated: { e:"💪", queries:["gym motivation","workout hits","motivational music"],
               words:["motivated","gym","workout","run","grind","push"] },
  nostalgic: { e:"📻", queries:["throwback hits","old classics","90s hits"],
               words:["nostalgic","old","memories","throwback","remember","miss"] }
};
const ENERGY = { any:"", low:"slow chill", high:"energetic" };
const SCOPES = "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state";
const REDIRECT = location.origin + location.pathname.replace(/index\.html$/, "");

/* ===== Helpers ===== */
const $ = id => document.getElementById(id);
const LS = {
  get:k => { try { return localStorage.getItem(k); } catch(e){ return null; } },
  set:(k,v) => { try { localStorage.setItem(k,v); } catch(e){} },
  del:k => { try { localStorage.removeItem(k); } catch(e){} }
};
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function status(msg, err=false) { $("status").textContent = msg; $("status").className = err ? "err" : ""; }

let currentMood = null, lastUri = null, deviceId = null, sdkPlayer = null, activated = false;

/* ===== Auth (PKCE: no client secret needed) ===== */
function randStr(n) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), x => chars[x % 62]).join("");
}
async function challenge(v) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function connect() {
  const id = $("clientId").value.trim();
  if (!id) return status("Paste your Spotify Client ID first.", true);
  LS.set("client_id", id);
  const verifier = randStr(64);
  LS.set("verifier", verifier);
  location.href = "https://accounts.spotify.com/authorize?" + new URLSearchParams({
    client_id:id, response_type:"code", redirect_uri:REDIRECT, scope:SCOPES,
    code_challenge_method:"S256", code_challenge: await challenge(verifier)
  });
}
async function tokenRequest(body) {
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body:new URLSearchParams(body)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || "Login failed");
  LS.set("token", d.access_token);
  LS.set("expires", String(Date.now() + d.expires_in * 1000 - 60000));
  if (d.refresh_token) LS.set("refresh", d.refresh_token);
}
async function handleRedirect() {
  const q = new URLSearchParams(location.search);
  if (q.get("error")) status("Spotify login cancelled: " + q.get("error"), true);
  if (q.get("code")) {
    try {
      await tokenRequest({ client_id:LS.get("client_id"), grant_type:"authorization_code",
        code:q.get("code"), redirect_uri:REDIRECT, code_verifier:LS.get("verifier") });
    } catch(e) { status(e.message, true); }
  }
  if (location.search) history.replaceState({}, "", REDIRECT);
}
async function getToken() {
  if (!LS.get("token")) return null;
  if (Date.now() > Number(LS.get("expires"))) {
    try { await tokenRequest({ client_id:LS.get("client_id"), grant_type:"refresh_token", refresh_token:LS.get("refresh") }); }
    catch(e) { logout(); return null; }
  }
  return LS.get("token");
}
function logout() {
  ["token","expires","refresh","verifier"].forEach(LS.del);
  if (sdkPlayer) sdkPlayer.disconnect();
  location.reload();
}
async function api(path, opts={}) {
  const t = await getToken();
  if (!t) throw new Error("Connect Spotify first.");
  return fetch("https://api.spotify.com/v1" + path, { ...opts, headers:{ Authorization:"Bearer " + t, "Content-Type":"application/json" } });
}

/* ===== In-browser player (Web Playback SDK, Premium) ===== */
function loadSdk() {
  window.onSpotifyWebPlaybackSDKReady = () => {
    sdkPlayer = new Spotify.Player({ name:"Mood Music Player", getOAuthToken: async cb => cb(await getToken()), volume:0.7 });
    sdkPlayer.addListener("ready", ({ device_id }) => { deviceId = device_id; });
    sdkPlayer.addListener("player_state_changed", renderNow);
    sdkPlayer.addListener("account_error", () => status("In-browser playback needs Spotify Premium. Using fallback player.", true));
    sdkPlayer.addListener("authentication_error", () => status("Spotify auth problem. Try Disconnect, then Connect again.", true));
    sdkPlayer.connect();
  };
  const s = document.createElement("script");
  s.src = "https://sdk.scdn.co/spotify-player.js";
  document.head.appendChild(s);
}
function renderNow(state) {
  if (!state) return;
  const t = state.track_window.current_track;
  $("nowCard").hidden = false;
  $("track").textContent = t.name;
  $("artist").textContent = t.artists.map(a => a.name).join(", ");
  $("art").src = (t.album.images[0] || {}).url || "";
}

/* ===== Mood logic ===== */
function detectMood(text) {
  const t = text.toLowerCase();
  let best = null, bestScore = 0;
  for (const [name, m] of Object.entries(MOODS)) {
    const score = m.words.filter(w => t.includes(w)).length;
    if (score > bestScore) { best = name; bestScore = score; }
  }
  return best;
}
async function searchPlaylists(q) {
  const r = await api("/search?type=playlist&limit=10&q=" + encodeURIComponent(q));
  if (!r.ok) throw new Error("Search failed (" + r.status + ")");
  const d = await r.json();
  return (d.playlists?.items || []).filter(Boolean);
}
async function pickMood(name) {
  if (!LS.get("token")) return status("Connect Spotify first.", true);
  currentMood = name;
  document.querySelectorAll(".mood").forEach(b => b.classList.toggle("active", b.dataset.mood === name));
  if (sdkPlayer && !activated) { sdkPlayer.activateElement(); activated = true; }
  status("Finding music for your mood...");
  try {
    const base = pick(MOODS[name].queries);
    const lang = $("lang").value === "any" ? "" : $("lang").value;
    let items = await searchPlaylists(`${base} ${lang} ${ENERGY[$("energy").value]}`.replace(/\s+/g, " ").trim());
    if (!items.length) items = await searchPlaylists(base);
    const fresh = items.filter(p => p.uri !== lastUri);
    if (!(fresh.length || items.length)) return status("No playlists found. Try again.", true);
    const p = pick(fresh.length ? fresh : items);
    lastUri = p.uri;
    $("another").hidden = false;
    await play(p);
    addHistory(name, p.name);
  } catch(e) { status(e.message, true); }
}
async function play(p) {
  let ok = false;
  if (deviceId) {
    await api("/me/player", { method:"PUT", body:JSON.stringify({ device_ids:[deviceId], play:false }) });
  }
  const url = "/me/player/play" + (deviceId ? "?device_id=" + deviceId : "");
  const r = await api(url, { method:"PUT", body:JSON.stringify({ context_uri:p.uri }) });
  ok = r.ok;
  if (ok) {
    $("embed").innerHTML = "";
    status("▶ Playing: " + p.name);
  } else {
    status("Couldn't control playback (needs Premium / open Spotify device). Showing the embedded player: " + p.name, true);
    $("embed").innerHTML = `<iframe height="352" allow="encrypted-media" src="https://open.spotify.com/embed/playlist/${encodeURIComponent(p.id)}"></iframe>`;
  }
}

/* ===== History ===== */
function loadHistory() { try { return JSON.parse(LS.get("history") || "[]"); } catch(e) { return []; } }
function addHistory(mood, playlist) {
  const h = loadHistory();
  h.unshift({ mood, playlist, t:Date.now() });
  LS.set("history", JSON.stringify(h.slice(0, 50)));
  renderHistory();
}
function renderHistory() {
  const h = loadHistory(), ul = $("history");
  ul.innerHTML = "";
  if (!h.length) { $("stats").textContent = "No history yet. Pick a mood!"; return; }
  const counts = {};
  h.forEach(x => counts[x.mood] = (counts[x.mood] || 0) + 1);
  const top = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
  $("stats").textContent = `${h.length} sessions. Most common mood: ${MOODS[top[0]].e} ${top[0]} (${top[1]}×)`;
  h.slice(0, 8).forEach(x => {
    const li = document.createElement("li"), a = document.createElement("span"), b = document.createElement("span");
    a.textContent = `${MOODS[x.mood].e} ${x.playlist}`;
    b.textContent = new Date(x.t).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
    li.append(a, b); ul.appendChild(li);
  });
}

/* ===== Init ===== */
function init() {
  $("redir").textContent = REDIRECT;
  $("clientId").value = LS.get("client_id") || "";
  for (const [name, m] of Object.entries(MOODS)) {
    const b = document.createElement("button");
    b.className = "mood"; b.dataset.mood = name;
    b.innerHTML = `<span class="e">${m.e}</span><span>${name[0].toUpperCase() + name.slice(1)}</span>`;
    b.onclick = () => pickMood(name);
    $("moods").appendChild(b);
  }
  $("connect").onclick = connect;
  $("logout").onclick = logout;
  $("another").onclick = () => currentMood && pickMood(currentMood);
  $("detect").onclick = () => {
    const m = detectMood($("feelText").value);
    m ? pickMood(m) : status("Couldn't tell your mood. Try words like happy, tired, focus, or tap a mood.", true);
  };
  $("feelText").addEventListener("keydown", e => { if (e.key === "Enter") $("detect").click(); });
  $("prev").onclick = () => sdkPlayer && sdkPlayer.previousTrack();
  $("next").onclick = () => sdkPlayer && sdkPlayer.nextTrack();
  $("toggle").onclick = () => sdkPlayer && sdkPlayer.togglePlay();
  $("vol").oninput = e => sdkPlayer && sdkPlayer.setVolume(e.target.value / 100);
  $("clearHist").onclick = () => { LS.del("history"); renderHistory(); };
  renderHistory();
}
(async () => {
  init();
  await handleRedirect();
  const on = !!LS.get("token");
  $("loggedOut").hidden = on;
  $("loggedIn").hidden = !on;
  if (on) loadSdk();
})();
