'use strict';

/**
 * normalize.js
 * Turns a messy pharmacy-bill line into clean, structured data.
 */

// Shorthand seen on Indian pharmacy bills -> the full word.
const ABBREVIATIONS = {
  TAB: 'TABLET', TABS: 'TABLET', TABLETS: 'TABLET', TB: 'TABLET', TBL: 'TABLET',
  CAP: 'CAPSULE', CAPS: 'CAPSULE', CAPSULES: 'CAPSULE', CP: 'CAPSULE',
  SYP: 'SYRUP', SYR: 'SYRUP', SUSP: 'SUSPENSION',
  INJ: 'INJECTION', VIAL: 'INJECTION', AMP: 'INJECTION',
  OINT: 'OINTMENT', CRM: 'CREAM', GEL: 'GEL',
  SACH: 'SACHET', SACHETS: 'SACHET', POWD: 'POWDER',
  DROP: 'DROPS', EYEDROP: 'DROPS'
};

// Words that carry no matching value - we delete them before comparing names.
const NOISE_WORDS = new Set([
  'STRIP', 'STRIPS', 'PCS', 'PC', 'NOS', 'NO', 'QTY', 'QUANTITY', 'RATE',
  'AMOUNT', 'AMT', 'MRP', 'BATCH', 'EXP', 'HSN', 'GST', 'CGST', 'SGST',
  'TOTAL', 'DISCOUNT', 'DISC', 'ITEM', 'SR', 'XR', 'ER', 'OD', 'DT', 'MD',
  'PLUS', 'FORTE', 'NEW', 'PACK', 'OF', 'X'
]);

const FORMS = [
  'TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION',
  'OINTMENT', 'CREAM', 'GEL', 'DROPS', 'SACHET', 'POWDER', 'INHALER'
];

/** Uppercase, strip odd characters, collapse spaces. */
function cleanText(text) {
  return String(text || '')
    .toUpperCase()
    .replace(/(\d),(\d)/g, '$1$2')      // 1,200.00 -> 1200.00
    .replace(/[₹]/g, ' ')
    .replace(/\bRS\.?\b/g, ' ')
    .replace(/[^A-Z0-9.'\s|/+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Replace TAB -> TABLET etc. and drop noise words. */
function expandAbbreviations(text) {
  return text
    .split(' ')
    .map((w) => ABBREVIATIONS[w] || w)
    .filter((w) => w.length > 0)
    .join(' ');
}

function isNumeric(token) {
  return /^\d+(\.\d+)?$/.test(token);
}

/** Find TABLET / CAPSULE / SYRUP ... inside the text. */
function detectForm(text) {
  for (const f of FORMS) {
    if (text.includes(f)) return f;
  }
  return null;
}

/** Find "650 MG", "40 MCG", "40 IU", "100 ML". */
function extractStrength(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(MG|MCG|GM|G|ML|IU|%)\b/);
  if (m) {
    let value = parseFloat(m[1]);
    let unit = m[2] === 'GM' ? 'G' : m[2];
    if (unit === 'G') { value = value * 1000; unit = 'MG'; }
    return { value, unit };
  }
  return null;
}

/** Find pack size: 15'S, 10S, 1X10, STRIP OF 10. */
function extractPack(text) {
  let m = text.match(/(\d+)\s*'?\s*S\b/);
  if (m) return parseInt(m[1], 10);
  m = text.match(/\b\d+\s*[X*]\s*(\d+)\b/);
  if (m) return parseInt(m[1], 10);
  m = text.match(/STRIP\s+OF\s+(\d+)/);
  if (m) return parseInt(m[1], 10);
  m = text.match(/(\d+)\s*(?:TABLET|CAPSULE|SACHET)S?\b/);
  if (m) return parseInt(m[1], 10);
  return null;
}

/**
 * Main parser. Input: one raw line of a bill.
 * Output: { raw, nameKey, brandGuess, strength, pack, qty, amount, form }
 */
function parseBillLine(rawLine) {
  const raw = String(rawLine || '').trim();
  if (!raw) return null;

  const cleaned = cleanText(raw);
  if (!cleaned || !/[A-Z]/.test(cleaned)) return null;

  const tokens = cleaned.split(/[\s|]+/).filter(Boolean);

  // Walk backwards collecting the trailing run of pure numbers.
  const trailing = [];
  let cut = tokens.length;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (isNumeric(tokens[i])) { trailing.unshift(parseFloat(tokens[i])); cut = i; }
    else break;
  }

  let qty = 1;
  let amount = null;
  let packHint = null;

  if (trailing.length === 1) {
    amount = trailing[0];
  } else if (trailing.length === 2) {
    qty = trailing[0];
    amount = trailing[1];
  } else if (trailing.length >= 3) {
    const last3 = trailing.slice(-3);
    packHint = Number.isInteger(last3[0]) && last3[0] <= 500 ? last3[0] : null;
    qty = last3[1];
    amount = last3[2];
  }

  if (qty <= 0 || qty > 500) qty = 1;

  const namePart = tokens.slice(0, cut).join(' ');
  const expanded = expandAbbreviations(namePart);

  const form = detectForm(expanded);
  const strength = extractStrength(expanded);
  let pack = extractPack(expanded) || packHint || 1;
  if (pack <= 0 || pack > 1000) pack = 1;

  // Build the pure-letters key used for name comparison.
  const nameWords = expanded
    .split(' ')
    .filter((w) => !NOISE_WORDS.has(w))
    .filter((w) => !FORMS.includes(w))
    .filter((w) => !/^\d/.test(w))
    .filter((w) => w.length > 1);

  const nameKey = nameWords.join(' ').trim();

  // Fallback strength: first standalone integer in the name that isn't the pack.
  let strengthValue = strength ? strength.value : null;
  let strengthUnit = strength ? strength.unit : null;
  if (strengthValue === null) {
    const ints = (namePart.match(/\b\d+\b/g) || []).map(Number);
    const candidate = ints.find((n) => n !== pack && n >= 2);
    if (candidate !== undefined) { strengthValue = candidate; strengthUnit = 'MG'; }
  }

  return {
    raw,
    cleaned,
    nameKey: nameKey || namePart,
    form,
    strength: strengthValue,
    strengthUnit,
    pack,
    qty,
    amount: amount === null ? 0 : amount
  };
}

/* ---------- String similarity maths ---------- */

/** Break a word into overlapping 3-letter chunks: CAT -> [" CA","CAT","AT "] */
function trigrams(str) {
  const padded = `  ${str.replace(/\s+/g, ' ')}  `;
  const out = new Set();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** How many trigrams two words share (0 = nothing, 1 = identical). */
function trigramSimilarity(a, b) {
  if (!a || !b) return 0;
  const A = trigrams(a);
  const B = trigrams(b);
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return (2 * shared) / (A.size + B.size);
}

/** Counts the single-letter edits needed to turn a into b. */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

function levenshteinSimilarity(a, b) {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / maxLen;
}

/** Blended score: trigrams + edit distance + a bonus if one contains the other. */
function similarity(a, b) {
  if (!a || !b) return 0;
  const A = a.trim();
  const B = b.trim();
  if (A === B) return 1;
  const tri = trigramSimilarity(A, B);
  const lev = levenshteinSimilarity(A, B);
  let score = 0.6 * tri + 0.4 * lev;
  if (A.includes(B) || B.includes(A)) score = Math.max(score, 0.88);
  if (A.split(' ')[0] === B.split(' ')[0]) score = Math.max(score, 0.8);
  return Math.min(1, score);
}

module.exports = {
  cleanText,
  expandAbbreviations,
  parseBillLine,
  similarity,
  trigramSimilarity,
  levenshteinSimilarity,
  detectForm,
  extractStrength,
  extractPack
};
