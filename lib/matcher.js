'use strict';

/**
 * matcher.js
 * Salt-level equivalence matching engine.
 *
 * Pipeline:
 *   1. Candidate generation  -> fuzzy name score against every brand + salt
 *   2. Deterministic rules   -> strength must agree, dosage form should agree
 *   3. Confidence scoring    -> weighted blend, exposed to the user
 */

const fs = require('fs');
const path = require('path');
const { similarity, cleanText } = require('./normalize');

const DRUG_FILE = path.join(__dirname, '..', 'data', 'drugs.json');

let INDEX = null;

/** Load drugs.json once and pre-compute searchable aliases. */
function loadIndex() {
  if (INDEX) return INDEX;
  const parsed = JSON.parse(fs.readFileSync(DRUG_FILE, 'utf8'));
  const drugs = parsed.drugs.map((d) => {
    const aliases = new Set();
    (d.brands || []).forEach((b) => aliases.add(cleanText(b).replace(/\d+/g, '').trim()));
    aliases.add(cleanText(d.salt).replace(/\d+/g, '').trim());
    cleanText(d.salt)
      .split(/[\s+]+/)
      .filter((w) => w.length > 3)
      .forEach((w) => aliases.add(w));
    return { ...d, aliases: [...aliases].filter(Boolean) };
  });
  INDEX = { meta: parsed.meta, drugs };
  return INDEX;
}

/** Strength comparison with unit awareness. Returns 1, 0.5 (unknown) or 0. */
function strengthScore(parsedStrength, parsedUnit, drug) {
  if (parsedStrength === null || parsedStrength === undefined) return 0.5;
  let a = parsedStrength;
  let b = drug.strength;
  let ua = parsedUnit || 'MG';
  let ub = drug.unit;

  if (ua === 'MCG' && ub === 'MG') { a = a / 1000; ua = 'MG'; }
  if (ua === 'MG' && ub === 'MCG') { a = a * 1000; ua = 'MCG'; }

  if (a === b) return 1;
  if (Math.abs(a - b) / Math.max(a, b) < 0.02) return 1;
  return 0;
}

function formScore(parsedForm, drug) {
  if (!parsedForm) return 0.5;
  return parsedForm === String(drug.form).toUpperCase() ? 1 : 0;
}

/**
 * Match one parsed line to the best drug.
 * Returns { drug, confidence, nameScore, status, alternatives }
 */
function matchLine(parsed) {
  const { drugs } = loadIndex();
  const key = parsed.nameKey;

  const scored = drugs.map((drug) => {
    let best = 0;
    let bestAlias = '';
    for (const alias of drug.aliases) {
      const s = similarity(key, alias);
      if (s > best) { best = s; bestAlias = alias; }
    }
    const sScore = strengthScore(parsed.strength, parsed.strengthUnit, drug);
    const fScore = formScore(parsed.form, drug);
    const confidence = 0.6 * best + 0.28 * sScore + 0.12 * fScore;
    return { drug, nameScore: best, strengthScore: sScore, formScore: fScore, confidence, bestAlias };
  });

  scored.sort((a, b) => b.confidence - a.confidence);

  const top = scored[0];
  const runnerUp = scored[1];

  if (!top || top.nameScore < 0.42) {
    return {
      drug: null,
      confidence: top ? Math.round(top.confidence * 100) / 100 : 0,
      status: 'unmatched',
      reason: 'No medicine in our database resembles this line.',
      alternatives: []
    };
  }

  let status = 'matched';
  let reason = `Brand "${top.bestAlias}" resolved to salt "${top.drug.salt}".`;

  if (top.confidence < 0.55) {
    status = 'unmatched';
    reason = 'Match too weak to trust.';
  } else if (top.confidence < 0.74 || (runnerUp && top.confidence - runnerUp.confidence < 0.06)) {
    status = 'ambiguous';
    reason = 'More than one medicine fits this line — please confirm.';
  } else if (top.strengthScore === 0) {
    status = 'ambiguous';
    reason = 'Brand matched but the strength printed on the bill does not agree.';
  }

  return {
    drug: status === 'unmatched' ? null : top.drug,
    confidence: Math.round(top.confidence * 100) / 100,
    nameScore: Math.round(top.nameScore * 100) / 100,
    status,
    reason,
    alternatives: scored.slice(0, 3).map((s) => ({
      id: s.drug.id,
      salt: s.drug.salt,
      strength: `${s.drug.strength} ${s.drug.unit}`,
      form: s.drug.form,
      confidence: Math.round(s.confidence * 100) / 100
    }))
  };
}

/** Every drug that shares this salt (used for the generic-alternative panel). */
function sameSaltOptions(drug) {
  if (!drug) return [];
  const { drugs } = loadIndex();
  return drugs.filter((d) => d.salt === drug.salt && d.form === drug.form);
}

function getAllDrugs() {
  return loadIndex().drugs;
}

function getGstRate() {
  return loadIndex().meta.gst_rate || 0.12;
}

module.exports = { matchLine, sameSaltOptions, getAllDrugs, getGstRate, loadIndex };
