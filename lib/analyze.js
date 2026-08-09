'use strict';

/**
 * analyze.js
 * Runs the full bill -> verdict pipeline and computes all money figures.
 */

const { parseBillLine } = require('./normalize');
const { matchLine, getGstRate } = require('./matcher');

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function analyzeBill(rawText) {
  const gst = getGstRate();
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const items = [];

  let billTotal = 0;
  let legalTotal = 0;
  let overchargeTotal = 0;
  let janAushadhiTotal = 0;
  let flaggedCount = 0;
  let reviewCount = 0;

  for (const line of lines) {
    const parsed = parseBillLine(line);
    if (!parsed || parsed.amount <= 0) continue;

    const match = matchLine(parsed);
    const units = Math.max(1, parsed.qty * parsed.pack);
    const paidPerUnit = round2(parsed.amount / units);

    billTotal += parsed.amount;

    const item = {
      raw: parsed.raw,
      brandGuess: parsed.nameKey,
      strength: parsed.strength ? `${parsed.strength} ${parsed.strengthUnit}` : 'not printed',
      form: parsed.form || 'unknown',
      pack: parsed.pack,
      qty: parsed.qty,
      units,
      amountPaid: round2(parsed.amount),
      paidPerUnit,
      confidence: match.confidence,
      status: match.status,
      reason: match.reason,
      alternatives: match.alternatives,
      salt: null,
      scheduled: false,
      ceilingPerUnit: null,
      legalMaxPerUnit: null,
      legalMaxTotal: null,
      overcharge: 0,
      overchargePct: 0,
      janAushadhiPerUnit: null,
      janAushadhiTotal: null,
      janAushadhiSaving: 0,
      janAushadhiCode: null,
      verdict: 'unknown'
    };

    if (!match.drug) {
      item.verdict = 'unknown';
      reviewCount++;
      legalTotal += parsed.amount;
      janAushadhiTotal += parsed.amount;
      items.push(item);
      continue;
    }

    const d = match.drug;
    item.salt = `${d.salt} ${d.strength} ${d.unit} ${d.form}`;
    item.scheduled = !!d.scheduled;
    item.janAushadhiCode = d.ja_code;

    if (d.ja_per_unit !== null && d.ja_per_unit !== undefined) {
      item.janAushadhiPerUnit = round2(d.ja_per_unit);
      item.janAushadhiTotal = round2(d.ja_per_unit * units);
      item.janAushadhiSaving = round2(Math.max(0, parsed.amount - item.janAushadhiTotal));
      janAushadhiTotal += item.janAushadhiTotal;
    } else {
      janAushadhiTotal += parsed.amount;
    }

    if (d.scheduled && d.ceiling_per_unit) {
      const legalMaxPerUnit = round2(d.ceiling_per_unit * (1 + gst));
      const legalMaxTotal = round2(legalMaxPerUnit * units);
      item.ceilingPerUnit = round2(d.ceiling_per_unit);
      item.legalMaxPerUnit = legalMaxPerUnit;
      item.legalMaxTotal = legalMaxTotal;

      const diff = round2(parsed.amount - legalMaxTotal);
      if (diff > 0.5 && match.status === 'matched') {
        item.overcharge = diff;
        item.overchargePct = Math.round((diff / legalMaxTotal) * 100);
        item.verdict = 'overcharged';
        overchargeTotal += diff;
        flaggedCount++;
        legalTotal += legalMaxTotal;
      } else if (match.status === 'ambiguous') {
        item.verdict = 'review';
        reviewCount++;
        legalTotal += parsed.amount;
      } else {
        item.verdict = 'fair';
        legalTotal += parsed.amount;
      }
    } else {
      item.verdict = match.status === 'ambiguous' ? 'review' : 'not_scheduled';
      if (match.status === 'ambiguous') reviewCount++;
      legalTotal += parsed.amount;
    }

    items.push(item);
  }

  const totalSavings = round2(Math.max(0, billTotal - janAushadhiTotal));

  return {
    items,
    summary: {
      lineCount: items.length,
      billTotal: round2(billTotal),
      legalTotal: round2(legalTotal),
      overchargeTotal: round2(overchargeTotal),
      overchargePct: billTotal > 0 ? Math.round((overchargeTotal / billTotal) * 100) : 0,
      janAushadhiTotal: round2(janAushadhiTotal),
      totalSavings,
      savingsPct: billTotal > 0 ? Math.round((totalSavings / billTotal) * 100) : 0,
      flaggedCount,
      reviewCount,
      gstRateUsed: gst
    },
    generatedAt: new Date().toISOString()
  };
}

module.exports = { analyzeBill };
