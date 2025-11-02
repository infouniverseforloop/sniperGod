// backend/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fetch = require('node-fetch');

const db = require('./db');
const rr = require('./resultResolver');
const quotexAdapter = require('./quotexAdapter');
const manipulationDetector = require('./manipulationDetector');
const ats = require('./autoTimeSync');
const pa = require('./patternAnalyzer');
const sa = require('./strategyAdvanced');
const aiLearner = require('./aiLearner');
const { computeSignalForSymbol, detectFVG } = require('./computeStrategy');
const { startBinanceStream } = require('./brokerAdapters/binanceAdapter');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const PORT = parseInt(process.env.PORT || '3000', 10);
const HISTORY_MAX = parseInt(process.env.HISTORY_MAX || '2000', 10);
const SIGNAL_INTERVAL_MS = parseInt(process.env.SIGNAL_INTERVAL_MS || '5000', 10);
const MIN_CONF = parseInt(process.env.MIN_BROADCAST_CONF || '20', 10);

const WATCH = (process.env.WATCH_SYMBOLS || 'EUR/USD,GBP/USD,USD/JPY,AUD/USD,USD/CAD,USD/CHF,NZD/USD')
  .split(',').map(s => s.trim().toUpperCase());

// bars store: per-symbol array of 1s bars {time,open,high,low,close,volume}
const bars = {};

// static files (optional built frontend)
app.use(express.static('public'));

// endpoints
app.get('/pairs', (req, res) => {
  res.json({ ok: true, pairs: WATCH.map(s => ({ symbol: s, available: true })), server_time: new Date().toISOString() });
});
app.get('/signals/history', (req, res) => {
  res.json({ ok: true, rows: db.listRecent(200) });
});

// broadcast helper
function broadcast(obj) {
  const raw = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(raw);
  });
}

// append tick -> make 1s bars
function appendTick(sym, price, qty, tsSec) {
  sym = sym.toUpperCase();
  bars[sym] = bars[sym] || [];
  const arr = bars[sym];
  const last = arr[arr.length - 1];
  if (!last || last.time !== tsSec) {
    arr.push({ time: tsSec, open: price, high: price, low: price, close: price, volume: qty || 1 });
    if (arr.length > HISTORY_MAX) arr.shift();
  } else {
    last.close = price;
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
    last.volume = (last.volume || 0) + (qty || 0);
  }
}

// simulate ticks for warming up / pairs with no live feed
function simulateTick(sym) {
  const isCrypto = /BTC|ETH|DOGE|SHIBA|PEPE|ARB|APTOS|BONK/i.test(sym);
  const base = isCrypto ? 100 : (sym.startsWith('EUR') ? 1.09 : 1.0);
  const noise = (Math.random() - 0.5) * (isCrypto ? 5 : 0.0025);
  const precision = isCrypto ? 4 : 4;
  const price = +(base + noise).toFixed(precision);
  const qty = Math.random() * (isCrypto ? 2 : 100);
  appendTick(sym, price, qty, Math.floor(Date.now() / 1000));
}

// start exchange adapter (binance) - optional
try {
  startBinanceStream(WATCH, appendTick);
} catch (e) {
  console.warn('binance adapter not active', e.message || e);
}

// auto-time sync
let serverTimeOffset = 0;
ats.startAutoTimeSync({ intervalMs: 60_000, onOffset: (offsetMs) => { serverTimeOffset = offsetMs; console.log('Time offset (ms):', offsetMs); }});

// auto-heal function (clean corrupted bars)
function autoHealAndOptimize() {
  try {
    for (const sym of Object.keys(bars)) {
      const data = bars[sym];
      if (!data || data.length < 3) continue;
      const cleaned = [];
      for (let i = 0; i < data.length; i++) {
        const b = data[i];
        if (!b || typeof b.close !== 'number' || !isFinite(b.close) || b.close <= 0) continue;
        if (i > 0 && b.time <= data[i - 1].time) continue;
        cleaned.push(b);
      }
      if (cleaned.length !== data.length) {
        bars[sym] = cleaned;
        console.log(`[HEAL] ${sym} repaired ${data.length - cleaned.length}`);
      }
    }
    if (global.gc) global.gc();
  } catch (e) {
    console.warn('autoHeal err', e.message || e);
  }
}
setInterval(autoHealAndOptimize, 120_000);

// result resolver starts (will check expiry and save results)
rr.startResultResolver({ db, barsRef: bars, aiLearner, broadcast });

// Quotex adapter start (placeholder)
quotexAdapter.startQuotexAdapter({
  apiUrl: process.env.QUOTEX_API_URL,
  username: process.env.QUOTEX_USERNAME,
  password: process.env.QUOTEX_PASSWORD,
  wsUrl: process.env.QUOTEX_WS_URL
}, {
  appendTick: (sym, price, qty, ts) => appendTick(sym.toUpperCase(), price, qty, ts),
  onOrderConfirm: (o) => console.log('Order confirm:', o)
}).catch(()=>{});

// Main signal loop: runs every SIGNAL_INTERVAL_MS
setInterval(() => {
  for (const sym of WATCH) {
    try {
      if (!bars[sym] || bars[sym].length < 100) { // require 100 1s bars for full analysis
        simulateTick(sym);
        continue;
      }

      const last100 = bars[sym].slice(-100);
      const manip = manipulationDetector.detect([], last100);
      if (manip.score > 50) {
        broadcast({ type: 'log', data: `Skip ${sym} due to manipulation score ${manip.score}` });
        continue;
      }

      const sig = computeSignalForSymbol(sym, bars, { market: 'binary', require100: true });
      if (!sig) continue;

      const fv = { fvg: detectFVG(last100), volumeSpike: false, manipulation: manip.score > 0, bos: 0 };
      try {
        const vols = last100.map(b => b.volume || 0);
        const avgVol = vols.slice(0, Math.max(1, vols.length - 1)).reduce((a,b)=>a+b,0) / Math.max(1, vols.length - 1);
        fv.volumeSpike = (last100[last100.length - 1].volume || 0) > avgVol * 2.2;
      } catch(e){}

      const boost = aiLearner.predictBoost ? aiLearner.predictBoost(fv) : 0;
      sig.confidence = Math.max(1, Math.min(99, Math.round((sig.confidence || 50) + boost)));

      if (sig.confidence < MIN_CONF) continue;

      sig.time = new Date().toISOString();
      db.insertSignal(sig);
      broadcast({ type: 'signal', data: sig });
      broadcast({ type: 'log', data: `Signal ${sig.symbol} ${sig.direction} conf:${sig.confidence}` });
    } catch (e) {
      console.warn('signal loop err', e && e.message ? e.message : e);
    }
  }
}, SIGNAL_INTERVAL_MS);

// WebSocket handlers
wss.on('connection', ws => {
  console.log('WS client connected');
  ws.send(JSON.stringify({ type: 'info', server_time: new Date().toISOString(), server_offset: serverTimeOffset }));
  ws.on('message', msg => {
    try {
      const m = JSON.parse(msg.toString());
      if (m.type === 'reqSignalNow') {
        const symbol = (m.pair || WATCH[0]).toUpperCase();
        const sig = computeSignalForSymbol(symbol, bars, { market: 'binary', require100: true });
        if (sig) {
          sig.time = new Date().toISOString();
          db.insertSignal(sig);
          ws.send(JSON.stringify({ type: 'signal', data: sig }));
        } else ws.send(JSON.stringify({ type: 'error', data: 'No confirmed signal right now' }));
      } else if (m.type === 'nextSignal') {
        const symbol = (m.pair || WATCH[0]).toUpperCase();
        const sig = computeSignalForSymbol(symbol, bars, { market: 'binary', require100: true, forceNext: true });
        if (sig) {
          sig.time = new Date().toISOString();
          db.insertSignal(sig);
          ws.send(JSON.stringify({ type: 'signal', data: sig }));
        } else ws.send(JSON.stringify({ type: 'info', data: 'No suitable opportunity right now — Hold' }));
      } else if (m.type === 'execTrade') {
        // exec via adapter (placeholder)
        const { pair, direction, amount } = m;
        quotexAdapter.placeTrade(pair, direction, amount, 1).then(r => {
          ws.send(JSON.stringify({ type: 'execResult', data: r }));
        }).catch(e => ws.send(JSON.stringify({ type: 'execError', data: e.message || e })));
      }
    } catch (e) {
      console.warn('ws parse err', e.message || e);
    }
  });

  ws.on('close', () => console.log('WS client disconnected'));
});

// start server
server.listen(PORT, () => {
  console.log(`Binary-sniper backend listening on ${PORT}, watching ${WATCH.join(',')}`);
});
