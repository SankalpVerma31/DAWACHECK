/* ================= DawaCheck frontend ================= */
'use strict';

let lastResult = null;
let kendraMap = null;
let kendraLayer = null;
let heatMapObj = null;
let allKendras = [];

const $ = (id) => document.getElementById(id);
const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const rupee2 = (n) => '₹' + Number(n || 0).toFixed(2);

/* ---------- Demo bills ---------- */
const DEMO_BILLS = {
  1: `DOLO 650 TAB 15'S 2 96.00
PAN 40 TAB 10'S 1 145.00
AZITHRAL 500 TAB 5'S 1 189.00
ZERODOL 100 TAB 10'S 1 74.00
BECOSULES CAP 20'S 1 96.00`,
  2: `GLYCIPHAGE 500 TAB 20'S 1 68.00
AMLONG 5 TAB 15'S 1 78.00
ATORVA 10 TAB 10'S 1 96.00
TELMA 40 TAB 15'S 1 165.00
THYRONORM 50 TAB 100'S 1 265.00`,
  3: `CROCIN 500 TAB 15'S 1 34.00
CETZINE TAB 10'S 1 32.00
MONTAIR 10 TAB 10'S 1 118.00
TAXIM O 200 TAB 10'S 1 210.00
CALPOL 650 TAB 15'S 1 62.00`
};

/* ---------- Language ---------- */
const I18N = {
  en: {},
  hi: {
    navScan: 'बिल जाँचें', navHow: 'यह कैसे काम करता है', navMap: 'ओवरचार्ज मैप',
    heroPill: 'सार्वजनिक NPPA और जन औषधि डेटा पर आधारित',
    heroTitle: 'अपना दवा का बिल स्कैन करें।<br />जानें आपसे कितना ज़्यादा वसूला गया।',
    heroSub: 'सरकार 900 से अधिक ज़रूरी दवाओं की अधिकतम कीमत तय करती है। इससे ज़्यादा वसूलना गैरकानूनी है। DawaCheck आपका बिल पाँच सेकंड में जाँचता है, सस्ता जेनेरिक विकल्प दिखाता है, और NPPA शिकायत पत्र तैयार करता है।',
    heroBtn: 'मेरा बिल जाँचें — मुफ़्त', heroBtn2: 'कैसे काम करता है',
    statsTitle: 'लाइव प्रभाव', statBills: 'बिल जाँचे गए',
    statOver: 'गैरकानूनी ओवरचार्जिंग पकड़ी गई', statSave: 'मरीज़ों की संभावित बचत',
    statFoot: 'पूरे भारत से लगातार अपडेट हो रहा है',
    scanTitle: 'बिल जाँचें', scanSub: 'फ़ोटो अपलोड करें, या खुद टाइप करें। दोनों काम करते हैं।',
    tabPhoto: '📷 बिल की फ़ोटो', tabText: '⌨️ टाइप करें',
    dzTitle: 'अपलोड करने के लिए टैप करें', dzSub: 'JPG या PNG। कुछ भी हमारे सर्वर पर सेव नहीं होता।',
    readBtn: 'यह बिल पढ़ें', textLabel: 'हर लाइन में एक दवा: नाम स्ट्रेंथ पैक मात्रा राशि',
    demoLabel: 'नमूना बिल आज़माएँ:', analyzeBtn: 'मेरा बिल जाँचें',
    pipeTitle: 'अंदर क्या होता है',
    p1t: '1. सामान्यीकरण', p1d: '“DOLO 650 TAB 15\'S” को ब्रांड, स्ट्रेंथ, फॉर्म, पैक और कीमत में बाँटा जाता है।',
    p2t: '2. फ़ज़ी मिलान', p2d: 'ट्राइग्राम और एडिट-डिस्टेंस से सॉल्ट खोजा जाता है, OCR की गलतियों के बावजूद।',
    p3t: '3. नियम जाँच', p3d: 'स्ट्रेंथ और फॉर्म मेल खाने चाहिए, वरना भरोसा घटा दिया जाता है।',
    p4t: '4. कीमत फ़ैसला', p4d: 'प्रति यूनिट कीमत बनाम NPPA सीलिंग + 12% GST। ऊपर = गैरकानूनी।',
    p5t: '5. भरोसा दिखाएँ', p5d: 'हर लाइन का स्कोर दिखता है। हम कभी झूठा दावा नहीं करते।',
    verdictLabel: 'फ़ैसला', vnPaid: 'आपने चुकाया', vnOver: 'गैरकानूनी ओवरचार्ज',
    vnJa: 'जन औषधि कीमत', vnSave: 'आप बचा सकते थे',
    speakBtn: '🔊 पढ़कर सुनाएँ', letterBtn: '📄 NPPA शिकायत बनाएँ', cardBtn: '📤 बचत कार्ड',
    lineTitle: 'लाइन-दर-लाइन विवरण', kendraTitle: 'नज़दीकी जन औषधि केंद्र',
    kendraSub: 'वही सॉल्ट, वही स्ट्रेंथ, 50–80% सस्ता।', geoBtn: '📍 मेरी लोकेशन',
    letterTitle: 'आपका शिकायत पत्र', letterSub: 'बिल से अपने-आप भरा गया। PDF डाउनलोड करें और भेजें।',
    letterEmpty: 'शिकायत पत्र बनाने के लिए बिल जाँचें।', pdfBtn: '⬇️ PDF डाउनलोड करें',
    howTitle: 'यह क्यों मायने रखता है',
    why1: 'भारत के कुल स्वास्थ्य खर्च का इतना हिस्सा आज भी लोगों की अपनी जेब से जाता है (NHA 2021–22), और दवाएँ इसका सबसे बड़ा हिस्सा हैं।',
    why2: 'ज़रूरी दवाओं की कानूनी अधिकतम कीमत DPCO के तहत तय है। इससे ज़्यादा लेना अपराध है — पर मरीज़ जाँच नहीं पाता।',
    why3: 'जन औषधि केंद्र वही दवा 50–80% सस्ते में देते हैं। केमिस्ट की दुकान पर खड़े ज़्यादातर लोगों को यह बताया ही नहीं जाता।',
    disclaimer: 'DawaCheck सार्वजनिक डेटा पर आधारित एक जानकारी उपकरण है। इस डेमो की कीमतें NPPA और PMBI सूचियों पर आधारित नमूना डेटा हैं और पुरानी हो सकती हैं। औपचारिक शिकायत से पहले आधिकारिक NPPA सूची से मिलान करें। यह कानूनी या चिकित्सीय सलाह नहीं है।',
    hmTitle: 'भारत का ओवरचार्ज हीटमैप',
    hmSub: 'हर स्कैन एक गुमनाम डेटा पॉइंट जोड़ता है। मिलकर ये दवा ओवरचार्जिंग का पहला क्राउडसोर्स्ड नक्शा बनाते हैं।',
    lgLow: '20% से कम औसत ओवरचार्ज', lgMid: '20–30%', lgHigh: '30% से ऊपर',
    footTag: 'सार्वजनिक दवा-मूल्य डेटा को दुकान पर उपयोगी बनाना।',
    footNote: 'Hack Devengers 1.0 के लिए बनाया गया · डेटा: NPPA (DPCO) और PMBI जन औषधि'
  }
};

let currentLang = 'en';
const originalText = new Map();

function applyLanguage(lang) {
  currentLang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!originalText.has(el)) originalText.set(el, el.innerHTML);
    if (lang === 'hi' && I18N.hi[key]) el.innerHTML = I18N.hi[key];
    else el.innerHTML = originalText.get(el);
  });
  $('langLabel').textContent = lang === 'hi' ? 'English' : 'हिंदी';
  document.documentElement.lang = lang;
}

$('langToggle').addEventListener('click', () => applyLanguage(currentLang === 'en' ? 'hi' : 'en'));

/* ---------- Tabs ---------- */
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    $('panel-' + tab.dataset.tab).classList.add('active');
  });
});

/* ---------- Demo chips ---------- */
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    $('billText').value = DEMO_BILLS[chip.dataset.demo];
    document.querySelector('.tab[data-tab="text"]').click();
    setStatus('Demo bill loaded. Now press "Analyse my bill".', 'ok');
  });
});

/* ---------- Status helper ---------- */
function setStatus(msg, kind) {
  const el = $('statusMsg');
  el.textContent = msg || '';
  el.className = 'status' + (kind ? ' ' + kind : '');
}

/* ---------- File upload ---------- */
let selectedFile = null;
const dropzone = $('dropzone');

$('fileInput').addEventListener('change', (e) => handleFile(e.target.files[0]));

['dragenter', 'dragover'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); })
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); })
);
dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('Please choose an image file (JPG or PNG).', 'err');
    return;
  }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = () => {
    $('preview').src = reader.result;
    $('preview').hidden = false;
    $('readBtn').disabled = false;
    setStatus('Bill loaded. Press "Read this bill".', 'ok');
  };
  reader.readAsDataURL(file);
}

$('readBtn').addEventListener('click', async () => {
  if (!selectedFile) return;
  setStatus('Reading your bill with AI…', 'busy');
  $('readBtn').disabled = true;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: reader.result, mimeType: selectedFile.type })
      });
      const data = await res.json();
      if (data.ok) {
        $('billText').value = data.text;
        document.querySelector('.tab[data-tab="text"]').click();
        setStatus('Text extracted. Check the lines, then press "Analyse my bill".', 'ok');
      } else {
        setStatus(data.error + ' Tip: use a demo bill or type the lines.', 'err');
        document.querySelector('.tab[data-tab="text"]').click();
      }
    } catch (err) {
      setStatus('Could not reach the server: ' + err.message, 'err');
    } finally {
      $('readBtn').disabled = false;
    }
  };
  reader.readAsDataURL(selectedFile);
});

/* ---------- Analyse ---------- */
$('analyzeBtn').addEventListener('click', async () => {
  const text = $('billText').value.trim();
  if (!text) {
    setStatus('Type your bill lines, or tap a demo bill above.', 'err');
    document.querySelector('.tab[data-tab="text"]').click();
    return;
  }
  setStatus('Matching salts and checking ceiling prices…', 'busy');
  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.error) { setStatus(data.error, 'err'); return; }
    lastResult = data;
    renderResults(data);
    setStatus('Done. Scroll down for your verdict.', 'ok');
    $('results').hidden = false;
    $('results').scrollIntoView({ behavior: 'smooth' });
    submitAnonymousReport(data);
  } catch (err) {
    setStatus('Something went wrong: ' + err.message, 'err');
  }
});

/* ---------- Render ---------- */
function renderResults(data) {
  const s = data.summary;

  $('vnPaid').textContent = rupee2(s.billTotal);
  $('vnOver').textContent = rupee2(s.overchargeTotal);
  $('vnJa').textContent = rupee2(s.janAushadhiTotal);
  $('vnSave').textContent = rupee2(s.totalSavings);

  if (s.overchargeTotal > 0) {
    $('verdictHeadline').textContent = `You were overcharged ${rupee2(s.overchargeTotal)}`;
    $('verdictSub').textContent =
      `${s.flaggedCount} of ${s.lineCount} items were priced above the legal NPPA ceiling (${s.overchargePct}% of your bill). Charging above the ceiling price is an offence under the DPCO.`;
  } else {
    $('verdictHeadline').textContent = 'No illegal overcharging detected';
    $('verdictSub').textContent =
      `All matched items were within the legal ceiling price — but you could still save ${rupee2(s.totalSavings)} by buying the same salts at a Jan Aushadhi Kendra.`;
  }

  const list = $('itemList');
  list.innerHTML = '';

  const LABELS = {
    overcharged: 'Overcharged',
    fair: 'Within legal price',
    review: 'Please verify',
    unknown: 'Not recognised',
    not_scheduled: 'No ceiling price'
  };

  data.items.forEach((it) => {
    const el = document.createElement('div');
    el.className = 'item ' + it.verdict;

    const ceilingCell = it.legalMaxPerUnit
      ? `<b>${rupee2(it.legalMaxPerUnit)}</b><span>Legal max / unit (incl. GST)</span>`
      : `<b>—</b><span>Not under price control</span>`;

    const jaCell = it.janAushadhiPerUnit
      ? `<b>${rupee2(it.janAushadhiPerUnit)}</b><span>Jan Aushadhi / unit</span>`
      : `<b>—</b><span>Jan Aushadhi / unit</span>`;

    const overLine = it.overcharge > 0
      ? `<p style="margin-top:12px;font-weight:700;color:#dc2626">
           ⚠ Overcharged by ${rupee2(it.overcharge)} (${it.overchargePct}% above the legal maximum)
         </p>`
      : it.janAushadhiSaving > 0
        ? `<p style="margin-top:12px;font-weight:600;color:#15803d">
             ✓ Same salt at a Jan Aushadhi Kendra: ${rupee2(it.janAushadhiTotal)} — you could save ${rupee2(it.janAushadhiSaving)}
           </p>`
        : '';

    el.innerHTML = `
      <div class="item-head">
        <div>
          <div class="item-name">${escapeHtml(it.raw)}</div>
          <div class="item-salt">${it.salt ? '🧪 ' + escapeHtml(it.salt) : 'Salt could not be identified from this line'}</div>
        </div>
        <span class="tag ${it.verdict}">${LABELS[it.verdict]}</span>
      </div>
      <div class="item-grid">
        <div class="ig"><b>${rupee2(it.paidPerUnit)}</b><span>You paid / unit</span></div>
        <div class="ig">${ceilingCell}</div>
        <div class="ig">${jaCell}</div>
        <div class="ig"><b>${it.units}</b><span>Units (${it.qty} × pack of ${it.pack})</span></div>
      </div>
      ${overLine}
      <div class="conf">
        <div class="conf-bar"><div class="conf-fill" style="width:${Math.round(it.confidence * 100)}%"></div></div>
        <div class="conf-text">Match confidence ${Math.round(it.confidence * 100)}% — ${escapeHtml(it.reason)}</div>
      </div>`;
    list.appendChild(el);
  });

  buildLetter();
  loadKendras();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Complaint letter ---------- */
function buildLetter() {
  if (!lastResult) return;
  const s = lastResult.summary;
  const name = $('cName').value || '[Your name]';
  const phone = $('cPhone').value || '[Your phone]';
  const pharmacy = $('cPharmacy').value || '[Pharmacy name]';
  const city = $('cCity').value || '[City / district]';
  const billNo = $('cBillNo').value || '[Bill number]';
  const date = $('cDate').value || '[Bill date]';

  const flagged = lastResult.items.filter((i) => i.verdict === 'overcharged');

  const lines = flagged.map((i, n) =>
    `${n + 1}. ${i.raw}
   Salt identified: ${i.salt}
   Units purchased: ${i.units}
   Amount charged: ${rupee2(i.amountPaid)}
   Legal maximum (ceiling + 12% GST): ${rupee2(i.legalMaxTotal)}
   Excess charged: ${rupee2(i.overcharge)} (${i.overchargePct}% above ceiling)`
  ).join('\n\n');

  const letter =
`To,
The Chairman
National Pharmaceutical Pricing Authority (NPPA)
3rd Floor, YMCA Cultural Centre Building
1 Jai Singh Road, New Delhi - 110001

Subject: Complaint regarding sale of scheduled formulations above the notified ceiling price under DPCO, 2013

Respected Sir/Madam,

I wish to bring to your notice that I was charged above the notified ceiling price for scheduled formulations at the following retail chemist:

   Pharmacy   : ${pharmacy}
   Location   : ${city}
   Bill number: ${billNo}
   Bill date  : ${date}

Details of the items charged above the ceiling price:

${flagged.length ? lines : 'No item on this bill exceeded the ceiling price.'}

Total excess amount charged: ${rupee2(s.overchargeTotal)}
Total bill value: ${rupee2(s.billTotal)}

I request the Authority to examine this matter, direct the recovery of the overcharged amount along with interest as provided under the Drugs (Prices Control) Order, 2013, and take such action against the retailer as may be appropriate.

A copy of the original bill is enclosed for your reference.

Yours faithfully,

${name}
Phone: ${phone}
Date: ${new Date().toLocaleDateString('en-IN')}

Enclosure: Copy of pharmacy bill
Note: Prices verified using publicly notified NPPA ceiling price data. Complainant requests verification against the current official list.`;

  $('letterPreview').textContent = letter;
  return letter;
}

['cName', 'cPhone', 'cPharmacy', 'cCity', 'cBillNo', 'cDate'].forEach((id) =>
  $(id).addEventListener('input', buildLetter)
);

$('letterBtn').addEventListener('click', () => {
  buildLetter();
  $('letterPreview').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

$('downloadPdf').addEventListener('click', () => {
  if (!lastResult) { alert('Analyse a bill first.'); return; }
  const text = buildLetter();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(9.5);
  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight() - margin;
  const wrapped = doc.splitTextToSize(text, width);
  let y = margin;
  wrapped.forEach((line) => {
    if (y > pageHeight) { doc.addPage(); y = margin; }
    doc.text(line, margin, y);
    y += 13;
  });
  doc.save('NPPA-complaint-DawaCheck.pdf');
});

/* ---------- Read aloud ---------- */
$('speakBtn').addEventListener('click', () => {
  if (!lastResult) return;
  window.speechSynthesis.cancel();
  const s = lastResult.summary;
  const msg =
    currentLang === 'hi'
      ? `आपके बिल की कुल राशि ${Math.round(s.billTotal)} रुपये है। आपसे ${Math.round(s.overchargeTotal)} रुपये गैरकानूनी रूप से अधिक वसूले गए हैं। जन औषधि केंद्र से वही दवाइयाँ लेने पर आप ${Math.round(s.totalSavings)} रुपये बचा सकते थे।`
      : `Your bill total is ${Math.round(s.billTotal)} rupees. You were overcharged ${Math.round(s.overchargeTotal)} rupees above the legal ceiling price. Buying the same medicines at a Jan Aushadhi Kendra would have saved you ${Math.round(s.totalSavings)} rupees.`;
  const u = new SpeechSynthesisUtterance(msg);
  u.lang = currentLang === 'hi' ? 'hi-IN' : 'en-IN';
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
});

/* ---------- Savings card ---------- */
$('cardBtn').addEventListener('click', () => {
  if (!lastResult) return;
  const s = lastResult.summary;
  const c = $('shareCanvas');
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 1080, 1080);
  g.addColorStop(0, '#0f766e');
  g.addColorStop(1, '#0b3d3a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = '#99f6e4';
  ctx.font = 'bold 34px Inter, sans-serif';
  ctx.fillText('DAWACHECK', 90, 140);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 62px Inter, sans-serif';
  ctx.fillText('I checked my', 90, 260);
  ctx.fillText('medicine bill.', 90, 335);

  ctx.fillStyle = '#fca5a5';
  ctx.font = 'bold 30px Inter, sans-serif';
  ctx.fillText('ILLEGALLY OVERCHARGED', 90, 470);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 110px Inter, sans-serif';
  ctx.fillText('₹' + Math.round(s.overchargeTotal), 90, 580);

  ctx.fillStyle = '#86efac';
  ctx.font = 'bold 30px Inter, sans-serif';
  ctx.fillText('I COULD HAVE SAVED', 90, 700);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 110px Inter, sans-serif';
  ctx.fillText('₹' + Math.round(s.totalSavings), 90, 810);

  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.font = '30px Inter, sans-serif';
  ctx.fillText(`On a bill of ₹${Math.round(s.billTotal)} · ${s.lineCount} medicines checked`, 90, 890);
  ctx.fillText('Check yours free — NPPA ceiling prices made readable.', 90, 950);

  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(50, 50, 980, 980);

  const link = document.createElement('a');
  link.download = 'dawacheck-savings-card.png';
  link.href = c.toDataURL('image/png');
  link.click();
});

/* ---------- Kendras + map ---------- */
async function loadKendras(lat, lng) {
  let url = '/api/kendras';
  if (lat && lng) url += `?lat=${lat}&lng=${lng}`;
  const res = await fetch(url);
  const data = await res.json();
  allKendras = data.kendras;

  if (!kendraMap) {
    kendraMap = L.map('kendraMap').setView([22.9734, 78.6569], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 18
    }).addTo(kendraMap);
    kendraLayer = L.layerGroup().addTo(kendraMap);

    const cities = [...new Set(allKendras.map((k) => k.city))].sort();
    $('citySelect').innerHTML =
      '<option value="">All cities</option>' +
      cities.map((c) => `<option value="${c}">${c}</option>`).join('');
  }

  drawKendras(allKendras);
  if (data.origin) {
    kendraMap.setView([data.origin.lat, data.origin.lng], 11);
    L.circleMarker([data.origin.lat, data.origin.lng], {
      radius: 9, color: '#dc2626', fillColor: '#dc2626', fillOpacity: .9
    }).addTo(kendraLayer).bindPopup('You are here');
  }
}

function drawKendras(list) {
  kendraLayer.clearLayers();
  const ul = $('kendraList');
  ul.innerHTML = '';
  const bounds = [];

  list.forEach((k) => {
    L.marker([k.lat, k.lng])
      .addTo(kendraLayer)
      .bindPopup(`<b>${k.name}</b><br>${k.address}<br>☎ ${k.phone}`);
    bounds.push([k.lat, k.lng]);

    const li = document.createElement('li');
    li.innerHTML = `<b>${k.name}</b>${k.address}${k.distanceKm !== undefined ? ` · <strong>${k.distanceKm} km away</strong>` : ''}`;
    ul.appendChild(li);
  });

  if (bounds.length) kendraMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
}

$('citySelect').addEventListener('change', (e) => {
  const city = e.target.value;
  drawKendras(city ? allKendras.filter((k) => k.city === city) : allKendras);
});

$('geoBtn').addEventListener('click', () => {
  if (!navigator.geolocation) { alert('Your browser does not support location.'); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => loadKendras(pos.coords.latitude, pos.coords.longitude),
    () => alert('Could not get your location. Pick a city from the dropdown instead.')
  );
});

/* ---------- Heatmap ---------- */
async function loadHeatmap() {
  const res = await fetch('/api/heatmap');
  const { districts } = await res.json();

  heatMapObj = L.map('heatMap').setView([22.9734, 79.5], 4.4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 18
  }).addTo(heatMapObj);

  districts.forEach((d) => {
    const colour = d.avgOverchargePct > 30 ? '#dc2626' : d.avgOverchargePct >= 20 ? '#f59e0b' : '#22c55e';
    L.circleMarker([d.lat, d.lng], {
      radius: Math.max(9, Math.sqrt(d.reports) * 1.7),
      color: colour, fillColor: colour, fillOpacity: .5, weight: 2
    })
      .addTo(heatMapObj)
      .bindPopup(
        `<b>${d.name}, ${d.state}</b><br>${d.reports} bills reported<br>Average overcharge: <b>${d.avgOverchargePct}%</b>`
      );
  });
}

/* ---------- Live counter ---------- */
function animateCount(el, target, prefix) {
  const start = performance.now();
  const dur = 1400;
  function frame(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const value = Math.round(target * eased);
    el.textContent = prefix ? prefix + value.toLocaleString('en-IN') : value.toLocaleString('en-IN');
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const s = await res.json();
    animateCount($('statBills'), s.billsScanned, '');
    animateCount($('statOvercharge'), s.overchargeDetected, '₹');
    animateCount($('statSavings'), s.potentialSavings, '₹');
  } catch (e) {
    console.warn('Stats unavailable', e);
  }
}

async function submitAnonymousReport(data) {
  try {
    await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overcharge: data.summary.overchargeTotal,
        savings: data.summary.totalSavings,
        district: $('cCity').value || null
      })
    });
    loadStats();
  } catch (e) {
    console.warn('Report not saved', e);
  }
}

/* ---------- Boot ---------- */
loadStats();
loadHeatmap();
loadKendras();
$('cDate').value = new Date().toISOString().slice(0, 10);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
