const API_BASE = "https://api.jolpi.ca/ergast/f1";
const CURRENT_YEAR = new Date().getFullYear();
const FIRST_SEASON = 1950;

let state = {
  tab: "drivers",
  season: CURRENT_YEAR,
  cache: {}, // key: `${tab}-${season}` -> data
};

const seasonSelect = document.getElementById("seasonSelect");
const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const errorMessage = document.getElementById("errorMessage");
const contentArea = document.getElementById("contentArea");
const statusLine = document.getElementById("statusLine");
const nextRaceBanner = document.getElementById("nextRaceBanner");
const retryBtn = document.getElementById("retryBtn");

// Populate season dropdown, newest first
for (let y = CURRENT_YEAR; y >= FIRST_SEASON; y--) {
  const opt = document.createElement("option");
  opt.value = y;
  opt.textContent = y;
  seasonSelect.appendChild(opt);
}
seasonSelect.value = CURRENT_YEAR;

seasonSelect.addEventListener("change", () => {
  state.season = parseInt(seasonSelect.value, 10);
  loadTab();
});

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.dataset.active = "false");
    btn.dataset.active = "true";
    state.tab = btn.dataset.tab;
    loadTab();
  });
});

retryBtn.addEventListener("click", loadTab);

function showLoading() {
  loadingState.classList.remove("hidden");
  errorState.classList.add("hidden");
  contentArea.classList.add("hidden");
  statusLine.classList.add("hidden");
}
function showError(msg) {
  loadingState.classList.add("hidden");
  errorState.classList.remove("hidden");
  contentArea.classList.add("hidden");
  errorMessage.textContent = msg;
}
function showContent() {
  loadingState.classList.add("hidden");
  errorState.classList.add("hidden");
  contentArea.classList.remove("hidden");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const data = await res.json();
  return data;
}

async function loadTab() {
  showLoading();
  nextRaceBanner.classList.add("hidden");
  const cacheKey = `${state.tab}-${state.season}`;
  try {
    let data = state.cache[cacheKey];
    if (!data) {
      if (state.tab === "drivers") {
        const json = await fetchJson(`${API_BASE}/${state.season}/driverStandings.json`);
        data = json.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
      } else if (state.tab === "constructors") {
        const json = await fetchJson(`${API_BASE}/${state.season}/constructorStandings.json`);
        data = json.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];
      } else if (state.tab === "schedule") {
        const json = await fetchJson(`${API_BASE}/${state.season}.json?limit=100`);
        data = json.MRData.RaceTable.Races || [];
      }
      state.cache[cacheKey] = data;
    }

    if (state.tab === "drivers") renderDrivers(data);
    else if (state.tab === "constructors") renderConstructors(data);
    else if (state.tab === "schedule") renderSchedule(data);

    statusLine.textContent = `${data.length} record${data.length === 1 ? "" : "s"} · ${state.season} season · source: jolpica-f1`;
    statusLine.classList.remove("hidden");
    showContent();
  } catch (err) {
    console.error(err);
    showError(err.message || "Something went wrong while reaching the API. Check your connection and try again.");
  }
}

function podiumClass(pos) {
  if (pos === 1) return "row-podium-1";
  if (pos === 2) return "row-podium-2";
  if (pos === 3) return "row-podium-3";
  return "";
}
function posBadge(pos) {
  let cls = "pos-badge";
  if (pos === 1) cls += " pos-1";
  else if (pos === 2) cls += " pos-2";
  else if (pos === 3) cls += " pos-3";
  return `<span class="${cls}">${pos}</span>`;
}

function emptyState(title, sub) {
  return `<div class="border border-[var(--line)] rounded-lg bg-[var(--surface)] px-6 py-16 text-center">
    <p class="font-display text-lg font-700" style="font-weight:700;">${title}</p>
    <p class="text-sm text-[var(--text-dim)] mt-2">${sub}</p>
  </div>`;
}

function renderDrivers(list) {
  if (!list.length) {
    contentArea.innerHTML = emptyState("No standings recorded", `The ${state.season} Drivers' Championship has no standings data yet.`);
    return;
  }
  const rows = list.map(d => {
    const pos = parseInt(d.position, 10);
    const name = `${d.Driver.givenName} ${d.Driver.familyName}`;
    const constructors = d.Constructors.map(c => c.name).join(" / ");
    return `<tr class="${podiumClass(pos)}">
      <td class="py-3 px-3 sm:px-4">${posBadge(pos)}</td>
      <td class="py-3 px-3 sm:px-4">
        <div class="font-semibold">${name}</div>
        <div class="text-xs text-[var(--text-dim)] font-mono">${d.Driver.nationality}${d.Driver.code ? " · " + d.Driver.code : ""}</div>
      </td>
      <td class="py-3 px-3 sm:px-4 text-[var(--text-dim)]">${constructors}</td>
      <td class="py-3 px-3 sm:px-4 font-mono text-right">${d.wins}</td>
      <td class="py-3 px-3 sm:px-4 font-mono font-bold text-right text-[var(--text)]">${d.points}</td>
    </tr>`;
  }).join("");

  contentArea.innerHTML = tableWrap(`
    <thead>
      <tr class="text-left text-[11px] uppercase tracking-wider text-[var(--text-dim)] border-b border-[var(--line)]">
        <th class="py-3 px-3 sm:px-4 font-mono">Pos</th>
        <th class="py-3 px-3 sm:px-4 font-mono">Driver</th>
        <th class="py-3 px-3 sm:px-4 font-mono">Constructor</th>
        <th class="py-3 px-3 sm:px-4 font-mono text-right">Wins</th>
        <th class="py-3 px-3 sm:px-4 font-mono text-right">Points</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `);
}

function renderConstructors(list) {
  if (!list.length) {
    const note = state.season < 1958
      ? "The Constructors' Championship began in 1958 — earlier seasons only crowned a Drivers' Champion."
      : `No constructor standings data found for ${state.season}.`;
    contentArea.innerHTML = emptyState("No standings recorded", note);
    return;
  }
  const rows = list.map(c => {
    const pos = parseInt(c.position, 10);
    return `<tr class="${podiumClass(pos)}">
      <td class="py-3 px-3 sm:px-4">${posBadge(pos)}</td>
      <td class="py-3 px-3 sm:px-4">
        <div class="font-semibold">${c.Constructor.name}</div>
        <div class="text-xs text-[var(--text-dim)] font-mono">${c.Constructor.nationality}</div>
      </td>
      <td class="py-3 px-3 sm:px-4 font-mono text-right">${c.wins}</td>
      <td class="py-3 px-3 sm:px-4 font-mono font-bold text-right text-[var(--text)]">${c.points}</td>
    </tr>`;
  }).join("");

  contentArea.innerHTML = tableWrap(`
    <thead>
      <tr class="text-left text-[11px] uppercase tracking-wider text-[var(--text-dim)] border-b border-[var(--line)]">
        <th class="py-3 px-3 sm:px-4 font-mono">Pos</th>
        <th class="py-3 px-3 sm:px-4 font-mono">Constructor</th>
        <th class="py-3 px-3 sm:px-4 font-mono text-right">Wins</th>
        <th class="py-3 px-3 sm:px-4 font-mono text-right">Points</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `);
}

function renderSchedule(races) {
  if (!races.length) {
    contentArea.innerHTML = emptyState("No calendar found", `No race schedule is available for ${state.season}.`);
    return;
  }

  // Next race banner only meaningful for current season
  if (state.season === CURRENT_YEAR) {
    const now = new Date();
    const upcoming = races.find(r => new Date(`${r.date}T${r.time || "00:00:00Z"}`) >= now);
    if (upcoming) {
      document.getElementById("nextRaceName").textContent = `${upcoming.raceName}`;
      document.getElementById("nextRaceMeta").textContent = `Round ${upcoming.round} · ${upcoming.Circuit.circuitName}, ${upcoming.Circuit.Location.country}`;
      updateCountdown(new Date(`${upcoming.date}T${upcoming.time || "00:00:00Z"}`));
      nextRaceBanner.classList.remove("hidden");
    }
  }

  const now = new Date();
  const rows = races.map(r => {
    const raceDate = new Date(`${r.date}T${r.time || "00:00:00Z"}`);
    const isPast = raceDate < now;
    const dateStr = raceDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    return `<tr class="${isPast ? "opacity-60" : ""}">
      <td class="py-3 px-3 sm:px-4 font-mono text-[var(--text-dim)]">${r.round}</td>
      <td class="py-3 px-3 sm:px-4">
        <div class="font-semibold">${r.raceName}</div>
        <div class="text-xs text-[var(--text-dim)] font-mono">${r.Circuit.circuitName}</div>
      </td>
      <td class="py-3 px-3 sm:px-4 text-[var(--text-dim)]">${r.Circuit.Location.locality}, ${r.Circuit.Location.country}</td>
      <td class="py-3 px-3 sm:px-4 font-mono text-right">${dateStr}</td>
      <td class="py-3 px-3 sm:px-4 text-right">
        ${isPast
          ? `<span class="text-[11px] uppercase tracking-wide text-[var(--text-dim)] font-mono">Completed</span>`
          : `<span class="text-[11px] uppercase tracking-wide text-[var(--red)] font-mono font-bold">Upcoming</span>`}
      </td>
    </tr>`;
  }).join("");

  contentArea.innerHTML = tableWrap(`
    <thead>
      <tr class="text-left text-[11px] uppercase tracking-wider text-[var(--text-dim)] border-b border-[var(--line)]">
        <th class="py-3 px-3 sm:px-4 font-mono">Rd</th>
        <th class="py-3 px-3 sm:px-4 font-mono">Grand Prix</th>
        <th class="py-3 px-3 sm:px-4 font-mono">Location</th>
        <th class="py-3 px-3 sm:px-4 font-mono text-right">Date</th>
        <th class="py-3 px-3 sm:px-4 font-mono text-right">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `);
}

function tableWrap(inner) {
  return `<div class="border border-[var(--line)] rounded-lg overflow-hidden bg-[var(--surface)]">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">${inner}</table>
    </div>
  </div>`;
}

let countdownTimer = null;
function updateCountdown(targetDate) {
  clearInterval(countdownTimer);
  const el = document.getElementById("nextRaceCountdown");
  function tick() {
    const diff = targetDate - new Date();
    if (diff <= 0) {
      el.textContent = "Lights out";
      clearInterval(countdownTimer);
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `${d}d ${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

loadTab();
