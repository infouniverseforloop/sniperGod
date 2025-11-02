import React, { useEffect, useState } from 'react';

export default function CountdownTimer({ expiry }){
  const [secs, setSecs] = useState(Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now())/1000)));

  useEffect(()=>{
    setSecs(Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now())/1000)));
    const t = setInterval(()=> setSecs(s=> { if(s<=0){ clearInterval(t); return 0;} return s-1; }), 1000);
    return ()=> clearInterval(t);
  }, [expiry]);

  return <div className="mt-3 text-lg font-bold">Time left: <span className="text-red-400">{secs}s</span></div>;
}
