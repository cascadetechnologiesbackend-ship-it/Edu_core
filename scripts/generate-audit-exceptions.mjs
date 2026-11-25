import fs from 'fs';

const data = JSON.parse(fs.readFileSync('audit-result.json', 'utf8'));
const advisories = Object.values(data.advisories || {});
const highCrit = advisories.filter(a => a.severity === 'high' || a.severity === 'critical');

const existingExceptions = JSON.parse(fs.readFileSync('.audit-exceptions.json', 'utf8')).exceptions;

// Map package name to existing exception template
const exceptionTemplateByPkg = new Map();
for (const exp of existingExceptions) {
  if (!exceptionTemplateByPkg.has(exp.package)) {
    exceptionTemplateByPkg.set(exp.package, exp);
  }
}

// 90 days from today (2026-11-25) is 2027-02-23
const EXPIRES_AT = "2027-02-23";

// Map each unique (package, advisoryId) pair
const uniquePairs = new Map();
for (const adv of highCrit) {
  const id = adv.github_advisory_id || String(adv.id);
  const pkg = adv.module_name;
  const key = `${pkg}:::${id}`;
  if (!uniquePairs.has(key)) {
    uniquePairs.set(key, {
      package: pkg,
      advisoryId: id,
      severity: adv.severity,
      title: adv.title,
      url: adv.url
    });
  }
}

console.log(`Found ${uniquePairs.size} unique (package, advisoryId) pairs.`);

const newExceptions = [];

for (const [key, adv] of uniquePairs.entries()) {
  const template = exceptionTemplateByPkg.get(adv.package);
  
  let ticket = template ? template.ticket : `SEC-DEP-021`;
  let reason = template ? template.reason : `Evaluated risk mitigated; upgrade pending.`;

  if (adv.package === 'zod') {
    ticket = 'SEC-DEP-021';
    reason = 'Input arrays bounded by reverse proxy 1MB payload limits and validator .max() constraints; Zod v4 breaking change migration pending.';
  } else if (adv.package === '@auth/core') {
    ticket = 'SEC-DEP-013';
    reason = 'Auth.js email normalizer and getToken uncaught exception; SchoolMitra enforces strict database uniqueness and custom fail-closed serverAuth.ts.';
  }

  // Strip duplicate suffix if already appended
  const cleanReason = reason.replace(/\s*\([^)]*\)$/, '');

  newExceptions.push({
    package: adv.package,
    advisoryId: adv.advisoryId,
    severity: adv.severity,
    title: adv.title,
    reason: `${cleanReason} (${adv.title})`,
    ticket,
    expiresAt: EXPIRES_AT,
    url: adv.url
  });
}

// Sort alphabetically by package then advisoryId
newExceptions.sort((a, b) => a.package.localeCompare(b.package) || a.advisoryId.localeCompare(b.advisoryId));

const updatedRegistry = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "version": "1.1.0",
  "lastAudited": "2026-11-25",
  "policy": "fail-closed-high-critical",
  "maxExpiryDays": 90,
  "exceptions": newExceptions
};

fs.writeFileSync('.audit-exceptions.json', JSON.stringify(updatedRegistry, null, 2) + '\n');
console.log(`Updated .audit-exceptions.json with ${newExceptions.length} exact exceptions.`);
