const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        results = results.concat(walk(fullPath));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('"use server"') || content.includes("'use server'")) {
        const hasDb = content.includes('@/db') || content.includes('@schoolmitra/database');
        const hasRequireAuth = content.includes('requireAuth(') || content.includes('auth(') || content.includes('assertConsent(') || content.includes('checkAuth(');
        const isPublic = content.includes('// PUBLIC:');
        results.push({
          file: fullPath.replace(/\\/g, '/'),
          hasDb,
          hasRequireAuth,
          isPublic
        });
      }
    }
  });
  return results;
}

const frontend = walk('v:/Cascade/Edu_core/Edu_core/frontend/src');
const backend = walk('v:/Cascade/Edu_core/Edu_core/backend/src');
const all = [...frontend, ...backend];

console.log(`Found ${all.length} files with "use server" directive:`);
all.forEach((item, idx) => {
  console.log(`${idx + 1}. [DB: ${item.hasDb ? 'YES' : 'NO '}] [AUTH: ${item.hasRequireAuth ? 'YES' : 'NO '}] [PUBLIC: ${item.isPublic ? 'YES' : 'NO '}] ${item.file}`);
});

const unguardedWithDb = all.filter(item => item.hasDb && !item.hasRequireAuth && !item.isPublic);
console.log(`\nUnguarded files with DB access without requireAuth/auth/PUBLIC annotation: ${unguardedWithDb.length}`);
unguardedWithDb.forEach(item => console.log(' - ' + item.file));
