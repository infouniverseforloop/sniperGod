// backend/computeStrategy.js
// Confluence based strategy requiring previous 100 1s bars
const TI = (() => {
  try { return require('technicalindicators'); } catch (e) { return null; }
})();

function sma(values, period){
  if(!values || values.length < period) return null;
  const arr = values.slice(-period);
  return arr.reduce((s,v)=>s+v,0)/period;
}
function rsi(values, period=14){
  if(!TI) {
    // fallback simple RSI-ish
    return 50;
  }
  const out = TI.RSI.calculate({ period, values });
  return out.length ? out[out.length-1] : 50;
}

function aggregate(bars, secondsPerBar){
  if(!bars || bars.length===0) return [];
  const out = [];
  let bucket = null;
  for(const b of bars){
    const t = Math.floor(b.time / secondsPerBar) * secondsPerBar;
    if(!bucket || bucket.time !== t){
      bucket = { time: t, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume||0 };
      out.push(bucket);
    } else {
      bucket.high = Math.max(bucket.high, b.high);
      bucket.low = Math.min(bucket.low, b.low);
      bucket.close = b.close;
      bucket.volume += b.volume||0;
    }
  }
  return out;
}

function detectOrderBlock(barsM1){
  if(!barsM1 || barsM1.length < 4) return false;
  const prev = barsM1[barsM1.length-2];
  const last = barsM1[barsM1.length-1];
  const prevBody = Math.abs(prev.close - prev.open);
  const avgBody = Math.max(1, barsM1.slice(-10).reduce((s,b)=> s + Math.abs(b.close - b.open),0) / Math.min(10, barsM1.length));
  if(prevBody > avgBody * 1.4 && ((last.close > last.open && prev.close < prev.open) || (last.close < last.open && prev.close > prev.open))){
    return true;
  }
  return false;
}

function detectFVG(barsM1){
  if(!barsM1 || barsM1.length < 3) return false;
  const a = barsM1[barsM1.length-3], b = barsM1[barsM1.length-2];
  if(!a||!b) return false;
  if(a.high < b.low) return true;
  if(a.low > b.high) return true;
  return false;
}

function computeSignalForSymbol(symbol, barsRef, opts={}){
  const bars = barsRef[symbol] || [];
  if(!bars || bars.length < 100) return null;

  const m1 = aggregate(bars, 60);
  if(m1.length < 30) return null;

  const sample = bars.slice(-100);
  const closes = sample.map(b=>b.close);
  const sma5 = sma(closes, Math.min(5, closes.length));
  const sma20 = sma(closes, Math.min(20, closes.length));
  const rsiVal = rsi(closes, 14) || 50;

  const volArr = sample.map(b=>b.volume||0);
  const avgVol = volArr.slice(0, Math.max(1, volArr.length-1)).reduce((a,b)=>a+b,0)/Math.max(1,volArr.length-1);
  const lastVol = volArr[volArr.length-1] || 0;
  const volSpike = lastVol > avgVol * 2.5;

  const last = sample[sample.length-1];
  const prev = sample[sample.length-2];
  const priceDelta = last.close - prev.close;

  const ob = detectOrderBlock(m1);
  const fvg = detectFVG(m1);
  const bullishMomentum = priceDelta > 0 && sma5 > sma20;
  const bearishMomentum = priceDelta < 0 && sma5 < sma20;

  let score = 50;
  if(bullishMomentum) score += 10;
  if(bearishMomentum) score -= 10;
  if(rsiVal < 30) score += 8;
  if(rsiVal > 70) score -= 8;
  if(volSpike) score += 6;
  if(ob) score += 7;
  if(fvg) score += 6;

  const p = last.close;
  const roundDist = Math.abs(Math.round(p) - p);
  if(roundDist < (p * 0.0007)) score += 4;

  const wickUp = last.high - Math.max(last.open, last.close);
  const wickDown = Math.min(last.open, last.close) - last.low;
  if(Math.max(wickUp, wickDown) > Math.abs(last.close - last.open) * 3) score -= 8;

  let layers = 0;
  if(bullishMomentum || bearishMomentum) layers++;
  if(ob || fvg) layers++;
  if(volSpike) layers++;
  if(rsiVal < 40 || rsiVal > 60) layers++;

  if(opts.require100 && layers < 2) return null;

  score = Math.max(10, Math.min(99, Math.round(score)));
  const direction = score >= 60 ? 'CALL' : (score <= 40 ? 'PUT' : (bullishMomentum ? 'CALL' : 'PUT'));

  const expirySeconds = parseInt(process.env.BINARY_EXPIRY_SECONDS || '60', 10);
  const expiryAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

  return {
    market: opts.market || 'binary',
    symbol,
    direction,
    confidence: score,
    entry: last.close,
    mtg: false,
    notes: `layers:${layers}|ob:${ob}|fvg:${fvg}|rsi:${Math.round(rsiVal)}`,
    time: new Date().toISOString(),
    expiry_at: expiryAt
  };
}

module.exports = { computeSignalForSymbol, detectFVG, aggregate };
