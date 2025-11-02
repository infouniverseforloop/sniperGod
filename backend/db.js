// backend/db.js
// lightweight sqlite storage using better-sqlite3 if available; fallback to in-memory
let useSqlite = false;
try {
  require.resolve('better-sqlite3');
  useSqlite = true;
} catch(e){ useSqlite = false; }

if (useSqlite) {
  const Database = require('better-sqlite3');
  const db = new Database('sniper.db');
  db.exec(`
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT, market TEXT, direction TEXT, confidence INTEGER,
      entry REAL, mtg INTEGER, notes TEXT, time_iso TEXT, expiry_iso TEXT,
      result TEXT, created_at INTEGER
    );
  `);
  module.exports = {
    insertSignal(sig){
      const stmt = db.prepare(`INSERT INTO signals (symbol,market,direction,confidence,entry,mtg,notes,time_iso,expiry_iso,created_at)
        VALUES (@symbol,@market,@direction,@confidence,@entry,@mtg,@notes,@time_iso,@expiry_iso,@created_at)`);
      stmt.run({
        symbol: sig.symbol, market: sig.market || 'binary', direction: sig.direction,
        confidence: sig.confidence, entry: sig.entry||0, mtg: sig.mtg?1:0,
        notes: sig.notes||'', time_iso: sig.time||new Date().toISOString(), expiry_iso: sig.expiry_at||new Date(Date.now()+60000).toISOString(),
        created_at: Date.now()
      });
    },
    saveResult(id, result){
      const s = db.prepare('UPDATE signals SET result = ? WHERE id = ?');
      s.run(result, id);
    },
    listRecent(limit=200){ return db.prepare('SELECT * FROM signals ORDER BY created_at DESC LIMIT ?').all(limit); }
  };
} else {
  // fallback simple in-memory array
  const arr = [];
  module.exports = {
    insertSignal(sig){ arr.push(sig); if(arr.length>5000) arr.shift(); },
    saveResult(id, result){
      // no-op for fallback
    },
    listRecent(limit=200){ return arr.slice(-limit).reverse(); }
  };
          }
