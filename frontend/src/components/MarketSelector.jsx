import React from 'react';

const PAIRS = ["EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CAD","USD/CHF","NZD/USD","AUD/NZD","USD/BDT","USD/PKR","Bitcoin","Gold"];

export default function MarketSelector({ pair, setPair }){
  return (
    <div className="mb-4">
      <select className="p-2 rounded bg-gray-900 border border-gray-700 text-white">
        {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  );
                                                       }
