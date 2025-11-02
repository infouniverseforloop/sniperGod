// backend/strategyAdvanced.js
// wrapper for advanced strategies (can combine computeStrategy layers)
const { computeSignalForSymbol } = require('./computeStrategy');

module.exports = {
  compute: (symbol, barsRef, opts={})=>{
    return computeSignalForSymbol(symbol, barsRef, opts);
  }
};
