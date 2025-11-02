import React from 'react';

export default function ResultLog({ signals }){
  return (
    <div className="p-4 bg-gray-800 rounded">
      <h3 className="font-bold mb-3">Signal History</h3>
      <div className="max-h-64 overflow-y-auto text-sm text-gray-300">
        {signals.map((s,i)=>(
          <div key={i} className="py-1 border-b border-gray-700">{s.symbol} — {s.direction} — {s.confidence}%</div>
        ))}
      </div>
    </div>
  );
}
