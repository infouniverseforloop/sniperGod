// backend/autoTimeSync.js
const fetch = require('node-fetch');

function startAutoTimeSync(opts = {}){
  const intervalMs = opts.intervalMs || 60000;
  const onOffset = typeof opts.onOffset === 'function' ? opts.onOffset : ()=>{};
  async function syncOnce(){
    try{
      const r = await fetch('http://worldtimeapi.org/api/timezone/Etc/UTC', { timeout: 8000 }).catch(()=>null);
      if(!r) return;
      const data = await r.json();
      const serverUtcMs = (data.unixtime ? data.unixtime*1000 : (new Date(data.utc_datetime || data.datetime)).getTime());
      const offset = serverUtcMs - Date.now();
      onOffset(offset);
    }catch(e){}
  }
  syncOnce();
  setInterval(syncOnce, intervalMs);
  return { stop: ()=>{} };
}

module.exports = { startAutoTimeSync };
