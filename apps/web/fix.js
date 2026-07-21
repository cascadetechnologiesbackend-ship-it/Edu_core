const fs = require('fs');
const path = require('path');
function fixDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      fixDir(p);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      let content = fs.readFileSync(p, 'utf8');
      if (content.includes('\\"')) {
        console.log('Fixing', p);
        content = content.replace(/\\"/g, '"');
        fs.writeFileSync(p, content, 'utf8');
      }
    }
  }
}
fixDir('src/app/(admin)/settings/grading');
