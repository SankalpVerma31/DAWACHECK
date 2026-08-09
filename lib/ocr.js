'use strict';

/**
 * ocr.js
 * Reads printed text out of a bill photo using Google Gemini (free tier).
 * Fails gracefully when no API key is configured.
 */

const MODEL = 'gemini-2.0-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const PROMPT = `You are reading an Indian pharmacy bill or prescription.
Extract ONLY the medicine line items. Output one medicine per line in exactly this format:

BRANDNAME STRENGTH FORM PACKSIZE QUANTITY AMOUNT

Rules:
- Keep the brand name exactly as printed.
- Write pack size like 15'S or 10'S when visible, otherwise omit it.
- QUANTITY is the number of packs/strips bought (default 1).
- AMOUNT is the line total in rupees as a plain number, e.g. 96.00
- Do NOT include headers, GST rows, totals, doctor names, or addresses.
- Do NOT add any explanation, bullet points or markdown. Plain lines only.

Example output:
DOLO 650 TAB 15'S 2 96.00
PAN 40 TAB 10'S 1 145.00`;

async function imageToText(base64Data, mimeType) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '') {
    return {
      ok: false,
      text: '',
      error: 'No Gemini API key configured. Please paste the bill text manually or use a demo bill.'
    };
  }

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64Data } }
        ]
      }
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
  };

  try {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, text: '', error: `Gemini responded ${res.status}: ${detail.slice(0, 200)}` };
    }

    const json = await res.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n').trim() || '';

    if (!text) return { ok: false, text: '', error: 'Could not read any medicine lines from that image.' };
    return { ok: true, text, error: null };
  } catch (err) {
    return { ok: false, text: '', error: `Network problem reaching Gemini: ${err.message}` };
  }
}

module.exports = { imageToText };
