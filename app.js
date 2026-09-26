import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, Timestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ---- 1. Fill this in with your Firebase project config ----
// (Firebase console -> Project settings -> General -> Your apps -> SDK setup and config)
const firebaseConfig = {
  apiKey: "AIzaSyAhGJKfNvyY77hPzpcfMv1Ugm9pCHWvzSI",
  authDomain: "hours-tracker-bec98.firebaseapp.com",
  projectId: "hours-tracker-bec98",
  storageBucket: "hours-tracker-bec98.firebasestorage.app",
  messagingSenderId: "1055092645862",
  appId: "1:1055092645862:web:efaad4bb7473fbf381c027"
};

// ---- 2. Employees ----
// Rename these to real names any time - the rest of the app just uses whatever is here.
const EMPLOYEES = ["Brian", "John", "Anthony", "Caleb"];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

signInAnonymously(auth).catch((err) => {
  console.error("Auth failed", err);
  alert("Couldn't connect. Check your internet connection and reload.");
});

const entriesRef = collection(db, "entries");
let entries = []; // all entries, live from Firestore

const clockGrid = document.getElementById("clockGrid");
const logBody = document.querySelector("#logTable tbody");
const summaryGrid = document.getElementById("summaryTable");
const monthSelect = document.getElementById("monthSelect");
const addEntryBtn = document.getElementById("addEntryBtn");
let showDraft = false;

// Default month picker to current month
const now = new Date();
monthSelect.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
monthSelect.addEventListener("change", renderSummary);
addEntryBtn.addEventListener("click", () => {
  showDraft = true;
  renderLog();
});

// ---- Build employee clock cards ----
function buildClockGrid() {
  clockGrid.innerHTML = "";
  EMPLOYEES.forEach((name) => {
    const card = document.createElement("div");
    card.className = "emp-card";
    card.dataset.employee = name;
    card.innerHTML = `
      <div class="top-row">
        <div class="name">${name}</div>
        <div class="dot"></div>
      </div>
      <div class="status" data-status></div>
      <button data-action></button>
    `;
    card.querySelector("button").addEventListener("click", () => handleClock(name));
    clockGrid.appendChild(card);
  });
}

function openEntryFor(name) {
  return entries.find((e) => e.employee === name && !e.clockOut);
}

async function handleClock(name) {
  const open = openEntryFor(name);
  if (open) {
    // Clock out
    await updateDoc(doc(db, "entries", open.id), {
      clockOut: serverTimestamp()
    });
  } else {
    // Clock in
    await addDoc(entriesRef, {
      employee: name,
      clockIn: serverTimestamp(),
      clockOut: null
    });
  }
}

function updateClockCards() {
  EMPLOYEES.forEach((name) => {
    const card = clockGrid.querySelector(`[data-employee="${name}"]`);
    if (!card) return;
    const open = openEntryFor(name);
    const statusEl = card.querySelector("[data-status]");
    const btn = card.querySelector("button");
    if (open) {
      const since = open.clockIn ? open.clockIn.toDate() : null;
      statusEl.textContent = since ? `In since ${formatTime(since)}` : "Clocked in";
      btn.textContent = "Clock Out";
      btn.className = "out";
      card.classList.add("active");
    } else {
      statusEl.textContent = "Not clocked in";
      btn.textContent = "Clock In";
      btn.className = "in";
      card.classList.remove("active");
    }
  });
}

// ---- Formatting helpers ----
function formatTime(d) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function formatDate(d) {
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
function toDateInputValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toTimeInputValue(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function hoursBetween(inD, outD) {
  if (!inD || !outD) return null;
  return (outD - inD) / (1000 * 60 * 60);
}

// ---- Render log table ----
function renderLog() {
  logBody.innerHTML = "";

  if (showDraft) {
    logBody.appendChild(buildDraftRow());
  }

  if (entries.length === 0) {
    if (!showDraft) {
      logBody.innerHTML = `<tr><td colspan="6" class="empty-note">No entries yet</td></tr>`;
    }
    return;
  }
  entries.forEach((e) => {
    const tr = document.createElement("tr");
    const inD = e.clockIn ? e.clockIn.toDate() : null;
    const outD = e.clockOut ? e.clockOut.toDate() : null;
    const hrs = hoursBetween(inD, outD);

    tr.innerHTML = `
      <td>${e.employee}</td>
      <td><input type="date" value="${inD ? toDateInputValue(inD) : ""}" data-field="date"></td>
      <td><input type="time" value="${inD ? toTimeInputValue(inD) : ""}" data-field="in"></td>
      <td><input type="time" value="${outD ? toTimeInputValue(outD) : ""}" data-field="out"></td>
      <td>${hrs !== null ? hrs.toFixed(2) : "—"}</td>
      <td class="row-actions"><button data-del>✕</button></td>
    `;

    tr.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => handleEdit(e, tr));
    });
    tr.querySelector("[data-del]").addEventListener("click", () => handleDelete(e.id));

    logBody.appendChild(tr);
  });
}

function buildDraftRow() {
  const tr = document.createElement("tr");
  tr.className = "draft-row";
  const todayStr = toDateInputValue(new Date());

  const empOptions = EMPLOYEES.map((n) => `<option value="${n}">${n}</option>`).join("");

  tr.innerHTML = `
    <td><select data-field="employee">${empOptions}</select></td>
    <td><input type="date" value="${todayStr}" data-field="date"></td>
    <td><input type="time" data-field="in"></td>
    <td><input type="time" data-field="out"></td>
    <td>—</td>
    <td class="draft-actions">
      <button class="save-btn" data-save>Save</button>
      <button class="cancel-btn" data-cancel>✕</button>
    </td>
  `;

  tr.querySelector("[data-cancel]").addEventListener("click", () => {
    showDraft = false;
    renderLog();
  });

  tr.querySelector("[data-save]").addEventListener("click", () => handleAddEntry(tr));

  return tr;
}

async function handleAddEntry(row) {
  const employee = row.querySelector('[data-field="employee"]').value;
  const dateVal = row.querySelector('[data-field="date"]').value;
  const inVal = row.querySelector('[data-field="in"]').value;
  const outVal = row.querySelector('[data-field="out"]').value;

  if (!dateVal || !inVal) {
    alert("Date and clock-in time are required.");
    return;
  }

  const [y, m, d] = dateVal.split("-").map(Number);
  const [ih, im] = inVal.split(":").map(Number);
  const clockIn = Timestamp.fromDate(new Date(y, m - 1, d, ih, im));

  let clockOut = null;
  if (outVal) {
    const [oh, om] = outVal.split(":").map(Number);
    clockOut = Timestamp.fromDate(new Date(y, m - 1, d, oh, om));
  }

  await addDoc(entriesRef, { employee, clockIn, clockOut });

  showDraft = false;
  renderLog();
}

async function handleEdit(entry, row) {
  const dateVal = row.querySelector('[data-field="date"]').value;
  const inVal = row.querySelector('[data-field="in"]').value;
  const outVal = row.querySelector('[data-field="out"]').value;
  if (!dateVal || !inVal) return;

  const [y, m, d] = dateVal.split("-").map(Number);
  const [ih, im] = inVal.split(":").map(Number);
  const newIn = new Date(y, m - 1, d, ih, im);

  const updates = { clockIn: Timestamp.fromDate(newIn) };

  if (outVal) {
    const [oh, om] = outVal.split(":").map(Number);
    const newOut = new Date(y, m - 1, d, oh, om);
    updates.clockOut = Timestamp.fromDate(newOut);
  } else {
    updates.clockOut = null;
  }

  await updateDoc(doc(db, "entries", entry.id), updates);
}

async function handleDelete(id) {
  if (!confirm("Delete this entry?")) return;
  await deleteDoc(doc(db, "entries", id));
}

// ---- Monthly summary ----
function renderSummary() {
  const [y, m] = monthSelect.value.split("-").map(Number);
  const totals = {};
  EMPLOYEES.forEach((name) => (totals[name] = 0));

  entries.forEach((e) => {
    if (!e.clockIn || !e.clockOut) return;
    const inD = e.clockIn.toDate();
    if (inD.getFullYear() === y && inD.getMonth() + 1 === m) {
      const hrs = hoursBetween(inD, e.clockOut.toDate());
      if (hrs) totals[e.employee] = (totals[e.employee] || 0) + hrs;
    }
  });

  summaryGrid.innerHTML = "";
  EMPLOYEES.forEach((name) => {
    const card = document.createElement("div");
    card.className = "total-card";
    card.innerHTML = `
      <div class="who">${name}</div>
      <div class="hrs">${totals[name].toFixed(1)}<span>hrs</span></div>
    `;
    summaryGrid.appendChild(card);
  });
}

// ---- Live header clock ----
const liveTimeEl = document.getElementById("liveTime");
const liveDateEl = document.getElementById("liveDate");

function tickClock() {
  const n = new Date();
  liveTimeEl.textContent = n.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  liveDateEl.textContent = n.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}
tickClock();
setInterval(tickClock, 1000);

// ---- Live listener ----
buildClockGrid();
const q = query(entriesRef, orderBy("clockIn", "desc"));
onSnapshot(q, (snap) => {
  entries = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => e.clockIn); // ignore docs mid-write with no timestamp yet

  updateClockCards();
  renderLog();
  renderSummary();
});
