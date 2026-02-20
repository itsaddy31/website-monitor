const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = path.join(__dirname, "db.json");

// ---------- DB ----------
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }));
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ---------- WORLD LATENCY NODES ----------
const regions = [
  { name: "India", url: "https://www.google.com" },
  { name: "US", url: "https://www.cloudflare.com" },
  { name: "EU", url: "https://www.wikipedia.org" }
];

// ---------- MONITOR ----------
async function checkSite(site) {
  try {
    const start = Date.now();
    await axios.get(site.url, { timeout: 5000 });
    site.status = "up";
    site.rt = Date.now() - start;
  } catch {
    site.status = "down";
    site.rt = null;
  }

  if (!site.history) site.history = [];
  site.history.push({ t: Date.now(), status: site.status, rt: site.rt });
  site.history = site.history.slice(-500);

  // SLA %
  const total = site.history.length;
  const up = site.history.filter(h => h.status === "up").length;
  site.sla = total ? ((up / total) * 100).toFixed(2) : 0;

  // incidents
  site.incidents = site.history
    .filter(h => h.status === "down")
    .slice(-20);
}

// ---------- LOOP ----------
setInterval(async () => {
  let db = loadDB();

  for (let user in db.users) {
    for (let site of db.users[user]) {
      await checkSite(site);
    }
  }

  saveDB(db);
}, 3000);

// ---------- WORLD LATENCY ----------
app.get("/api/latency", async (req, res) => {
  const results = [];

  for (let r of regions) {
    try {
      const s = Date.now();
      await axios.get(r.url, { timeout: 3000 });
      results.push({ region: r.name, latency: Date.now() - s });
    } catch {
      results.push({ region: r.name, latency: null });
    }
  }

  res.json(results);
});

// ---------- USER SITES ----------
app.get("/api/:user", (req, res) => {
  const db = loadDB();
  res.json(db.users[req.params.user] || []);
});

app.post("/api/:user/add", (req, res) => {
  const { url } = req.body;
  let db = loadDB();
  if (!db.users[req.params.user]) db.users[req.params.user] = [];
  db.users[req.params.user].push({ url, status: "unknown", history: [] });
  saveDB(db);
  res.json({ ok: true });
});

app.post("/api/:user/remove", (req, res) => {
  const { url } = req.body;
  let db = loadDB();
  db.users[req.params.user] = (db.users[req.params.user] || []).filter(
    s => s.url !== url
  );
  saveDB(db);
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "public/index.html"))
);

app.listen(process.env.PORT || 3000);
