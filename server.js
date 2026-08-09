'use strict';

require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');

const { analyzeBill } = require('./lib/analyze');
const { imageToText } = require('./lib/ocr');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const KENDRA_FILE = path.join(DATA_DIR, 'kendras.json');

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

/** Distance in km between two lat/lng points. */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}

/* ------------------------- ROUTES ------------------------- */

// Homepage counter numbers
app.get('/api/stats', (req, res) => {
  try {
    res.json(readJSON(STATS_FILE));
  } catch (e) {
    res.status(500).json({ error: 'Could not read stats.' });
  }
});

// District-level overcharge heatmap
app.get('/api/heatmap', (req, res) => {
  try {
    res.json({ districts: readJSON(STATS_FILE).districts });
  } catch (e) {
    res.status(500).json({ error: 'Could not read heatmap data.' });
  }
});

// Nearest Jan Aushadhi Kendras
app.get('/api/kendras', (req, res) => {
  try {
    const { kendras } = readJSON(KENDRA_FILE);
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      const withDistance = kendras
        .map((k) => ({ ...k, distanceKm: haversine(lat, lng, k.lat, k.lng) }))
        .sort((a, b) => a.distanceKm - b.distanceKm);
      return res.json({ kendras: withDistance.slice(0, 8), origin: { lat, lng } });
    }
    res.json({ kendras, origin: null });
  } catch (e) {
    res.status(500).json({ error: 'Could not read kendra data.' });
  }
});

// Photo -> text
app.post('/api/ocr', async (req, res) => {
  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64) return res.status(400).json({ ok: false, error: 'No image received.' });
  const clean = String(imageBase64).replace(/^data:[^;]+;base64,/, '');
  const result = await imageToText(clean, mimeType);
  res.json(result);
});

// Text -> full analysis
app.post('/api/analyze', (req, res) => {
  const { text } = req.body || {};
  if (!text || String(text).trim().length < 3) {
    return res.status(400).json({ error: 'Please provide the bill text.' });
  }
  try {
    res.json(analyzeBill(text));
  } catch (e) {
    res.status(500).json({ error: `Analysis failed: ${e.message}` });
  }
});

// Anonymous contribution to the public dataset
app.post('/api/report', (req, res) => {
  const { overcharge, savings, district } = req.body || {};
  try {
    const stats = readJSON(STATS_FILE);
    stats.billsScanned += 1;
    stats.usersHelped += 1;
    stats.overchargeDetected += Math.max(0, Math.round(Number(overcharge) || 0));
    stats.potentialSavings += Math.max(0, Math.round(Number(savings) || 0));

    if (district) {
      const d = stats.districts.find((x) => x.name.toLowerCase() === String(district).toLowerCase());
      if (d) {
        d.reports += 1;
        if (Number(overcharge) > 0) {
          d.avgOverchargePct = Math.round((d.avgOverchargePct * 0.9) + (10 * 0.1) + 1);
          if (d.avgOverchargePct > 95) d.avgOverchargePct = 95;
        }
      }
    }

    writeJSON(STATS_FILE, stats);
    res.json({ ok: true, stats });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Could not save the report.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ocrConfigured: !!(process.env.GEMINI_API_KEY || '').trim() });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ✅  DawaCheck is running!');
  console.log(`  🌐  Open this in your browser:  http://localhost:${PORT}`);
  console.log(`  🔑  Gemini OCR: ${(process.env.GEMINI_API_KEY || '').trim() ? 'ENABLED' : 'not set (manual entry still works)'}`);
  console.log('');
});
