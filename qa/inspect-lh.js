const fs = require('fs');
const files = fs.readdirSync('.lighthouseci').filter(f => f.endsWith('.json'));
const data = JSON.parse(fs.readFileSync('.lighthouseci/' + files[files.length - 1], 'utf8'));
console.log('=== LIGHTHOUSE RESULTS ===');
console.log('URL:', data.finalDisplayedUrl || data.finalUrl);
console.log('\n--- Category Scores ---');
for (const [k, v] of Object.entries(data.categories)) {
  console.log(`${v.title} (${k}): ${Math.round(v.score * 100)} / 100`);
}
console.log('\n--- Metric Timings ---');
const metrics = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index'
];
for (const m of metrics) {
  if (data.audits[m]) {
    console.log(`${data.audits[m].title}: ${data.audits[m].displayValue} (Score: ${Math.round(data.audits[m].score * 100)})`);
  }
}
console.log('\n--- Opportunities & Issues (score < 1) ---');
for (const [k, v] of Object.entries(data.audits)) {
  if (v.score !== null && v.score < 1 && v.scoreDisplayMode !== 'notApplicable' && v.scoreDisplayMode !== 'informative') {
    console.log(`- [Score: ${v.score}] ${v.title} (${k})`);
    if (v.displayValue) console.log(`    Value: ${v.displayValue}`);
    if (v.description) console.log(`    Info: ${v.description.slice(0, 120)}...`);
  }
}
