// backend/patternAnalyzer.js
module.exports = {
  analyze(bars = [], symbol=''){
    if(!bars || bars.length < 3) return { trend:'flat', pattern:null, strength:0 };
    const last = bars[bars.length-1], prev = bars[bars.length-2];
    const trend = last.close > prev.close ? 'up' : (last.close < prev.close ? 'down' : 'flat');
    // simple pattern detectors: FVG / OB placeholder
    const fvg = last.high < prev.low || last.low > prev.high;
    return { trend, pattern: fvg ? 'fvg' : null, strength: Math.abs(last.close - prev.close) };
  }
};
