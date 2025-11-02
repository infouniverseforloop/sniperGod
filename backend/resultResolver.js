// backend/resultResolver.js
const db = require('./db');

function defaultComparator(signalRow, finalPrice){
  if(!finalPrice) return { result:'UNKNOWN', won:false };
  const entry = Number(signalRow.entry || signalRow.entry_price || 0);
  if(signalRow.direction === 'CALL') return { result: finalPrice >= entry ? 'WIN' : 'LOSS', won: finalPrice >= entry };
  return { result: finalPrice <= entry ? 'WIN' : 'LOSS', won: finalPrice <= entry };
}

function startResultResolver(opts = {}){
  const barsRef = opts.barsRef || {};
  const aiLearner = opts.aiLearner;
  const broadcast = opts.broadcast;
  const checkIntervalMs = opts.checkIntervalMs || 3000;

  setInterval(()=>{
    try{
      const rows = db.listRecent(200);
      for(const r of rows){
        if(r.result) continue;
        // flexible expiry key names
        const expiryIso = r.expiry_iso || r.expiry_at || r.expiry;
        if(!expiryIso) continue;
        const expiryMs = new Date(expiryIso).getTime();
        if(Date.now() < expiryMs) continue;
        const bars = (barsRef[r.symbol]||[]);
        const expirySec = Math.floor(expiryMs/1000);
        let finalBar = bars.find(b=>b.time >= expirySec) || bars[bars.length-1];
        if(!finalBar) continue;
        const finalPrice = finalBar.close;
        const out = defaultComparator(r, finalPrice);
        try { db.saveResult(r.id || 0, out.result); } catch(e){}
        if(aiLearner && aiLearner.recordOutcome){
          const fv = { fvg:false, volumeSpike:false, manipulation:false, bos:0 };
          aiLearner.recordOutcome(fv, out.won);
        }
        if(broadcast) broadcast({ type:'signal_result', data:{ symbol: r.symbol, time_iso: r.time_iso || r.time, result: out.result, finalPrice }});
      }
    } catch(e) {
      console.warn('resultResolver err', e && e.message ? e.message : e);
    }
  }, checkIntervalMs);
}

module.exports = { startResultResolver };
