const fs = require('fs');
const data = JSON.parse(fs.readFileSync('.unlighthouse/ci-result.json', 'utf8'));

console.log('=== UNLIGHTHOUSE RESULTS ===');
console.log('Total routes scanned:', data.length);
for (const item of data) {
  console.log(`\nRoute: ${item.route?.path || item.path}`);
  console.log('Scores:');
  for (const cat of item.report?.categories || []) {
    console.log(`  ${cat.title}: ${Math.round(cat.score * 100)} / 100`);
  }
}
