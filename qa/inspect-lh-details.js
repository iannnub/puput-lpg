const fs = require('fs');
const files = fs.readdirSync('.lighthouseci').filter(f => f.endsWith('.json'));
const data = JSON.parse(fs.readFileSync('.lighthouseci/' + files[files.length - 1], 'utf8'));

console.log('--- COLOR CONTRAST DETAILS ---');
console.log(JSON.stringify(data.audits['color-contrast'].details?.items || [], null, 2));

console.log('\n--- ROBOTS.TXT DETAILS ---');
console.log(JSON.stringify(data.audits['robots-txt'].details || {}, null, 2));

console.log('\n--- META DESCRIPTION DETAILS ---');
console.log(data.audits['meta-description'].explanation || data.audits['meta-description'].description);

console.log('\n--- IMAGE DELIVERY / RESPONSIVE IMAGES ---');
console.log(JSON.stringify(data.audits['uses-responsive-images'].details?.items || [], null, 2));
