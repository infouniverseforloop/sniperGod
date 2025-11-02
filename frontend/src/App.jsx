import React, { useEffect, useState } from 'react';
import SignalCard from './components/SignalCard';
import CountdownTimer from './components/CountdownTimer';
import ResultLog from './components/ResultLog';
import MarketSelector from './components/MarketSelector';

const WS_URL = process.env.REACT_APP_WS_URL || ((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws');

export default function App(){
  const [signals, setSignals] = useState([]);
  const [currentSignal, setCurrentSignal] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(()=>{
    const socket = new WebSocket(WS_URL);
    socket.onopen = () => pushLog('WS connected');
    socket.onmessage = (evt) => {
      try {
        const m = JSON.parse(evt.data);
        if(m.type === 'signal'){ setSignals(s => [m.data, ...s].slice(0,200)); setCurrentSignal(m.data); pushLog(`Signal ${m.data.symbol} ${m.data.direction} ${m.data.confidence}`); }
        else if(m.type === 'log') pushLog(m.data);
        else if(m.type === 'info') pushLog(JSON.stringify(m));
        else if(m.type === 'signal_result') pushLog(`Result ${m.data.symbol} ${m.data.result}`);
      } catch(e){}
    };
    socket.onclose = ()=> pushLog('WS closed');
    socket.onerror = (e)=> pushLog('WS error');
    return ()=> socket.close();
  },[]);

  function pushLog(t){ setLogs(ls => [ `[${new Date().toLocaleTimeString()}] ${t}`, ...ls ].slice(0,500)); }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-yellow-400">Binary Sniper God</h1>
          <p className="text-sm text-gray-300">Auto-learning • Auto-heal • Trap-detect • 1-min Binary signals</p>
        </div>
        <div className="text-sm text-gray-400">Owner: David Mamun William</div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="p-4 bg-gray-800 rounded">
            <MarketSelector />
            { currentSignal ? <SignalCard signal={currentSignal} /> : <div className="text-gray-400 p-4">No signal yet — waiting...</div> }
            { currentSignal && <CountdownTimer expiry={currentSignal.expiry_at} /> }
          </div>
          <ResultLog signals={signals} />
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-gray-800 rounded">
            <h3 className="font-bold">Pairs Loaded</h3>
            <div className="text-sm text-gray-300 mt-2">
              EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF, NZD/USD...
            </div>
          </div>
          <div className="p-4 bg-gray-800 rounded">
            <h3 className="font-bold">System</h3>
            <div className="text-sm text-gray-300 mt-2">AutoTimeSync: ON • AutoHeal: ON • AutoLearn: ON</div>
          </div>
        </div>
      </div>
    </div>
  );
          }
