// backend/brokerAdapters/binanceAdapter.js
// Lightweight placeholder. You can extend to real Binance WS.
module.exports.startBinanceStream = (symbols = [], onTick = ()=>{})=>{
  console.log('binanceAdapter placeholder started for', symbols.length, 'symbols');
  // no live connection by default; implement when needed
  return { stop: ()=>{} };
};
