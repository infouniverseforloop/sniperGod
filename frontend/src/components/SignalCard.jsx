import React from 'react';

export default function SignalCard({ signal }){
  return (
    <div className="p-4 bg-gradient-to-r from-yellow-300 to-yellow-500 text-black rounded shadow signal-pulse mb-4">
      <div className="text-xl font-bold">{signal.symbol}</div>
      <div className="mt-2">Direction: <span className="font-extrabold">{signal.direction}</span></div>
      <div>Confidence: <span className="font-bold">{signal.confidence}%</span></div>
      <div className="text-sm mt-1 text-gray-800">Notes: {signal.notes}</div>
    </div>
  );
}
