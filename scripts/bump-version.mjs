#!/usr/bin/env node
/**
 * SchoolMitra ERP Monorepo Semantic Version Bumper
 *
 * Usage:
 *   node scripts/bump-version.mjs patch
 *   node scripts/bump-version.mjs minor
 *   node scripts/bump-version.mjs major
 *   node scripts/bump-version.mjs 11.0.0
 *   node scripts/bump-version.mjs auto
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

const PACKAGE_JSON_PATHS = [
  path.join(ROOT_DIR, "package.json"),
  path.join(ROOT_DIR, "frontend", "package.json"),
  path.join(ROOT_DIR, "backend", "package.json"),
  path.join(ROOT_DIR, "database", "package.json"),
];

// Add all packages in packages/*
const PACKAGES_DIR = path.join(ROOT_DIR, "packages");
if (fs.existsSync(PACKAGES_DIR)) {
  for (const entry of fs.readdirSync(PACKAGES_DIR)) {
    const pkgJsonPath = path.join(PACKAGES_DIR, entry, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      PACKAGE_JSON_PATHS.push(pkgJsonPath);
    }
  }
}

function parseSemver(v) {
  const clean = v.replace(/^v/, "").trim();
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) {
    throw new Error(`Invalid semver version: ${v}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
  };
}

function getGitRange() {
  try {
    const latestTag = execSync("git describe --tags --abbrev=0", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (latestTag) {
      return `${latestTag}..HEAD`;
    }
  } catch (err) {
    // No tags found yet
  }
  return "-n 15";
}

function detectBumpTypeFromGit() {
  const range = getGitRange();
  let log = "";
  try {
    log = execSync(`git log ${range} --pretty=format:"%s%n%b"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch (err) {
    log = execSync(`git log -n 5 --pretty=format:"%s%n%b"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  }

  if (/BREAKING CHANGE|breaking-change|feat!|fix!/i.test(log)) {
    return "major";
  }
  if (/^feat(\([a-z0-9_-]+\))?:/m.test(log)) {
    return "minor";
  }
  return "patch";
}

function computeNewVersion(currentVersion, bumpTypeOrVersion) {
  const current = parseSemver(currentVersion);

  if (/^\d+\.\d+\.\d+/.test(bumpTypeOrVersion)) {
    return bumpTypeOrVersion.replace(/^v/, "").trim();
  }

  let type = bumpTypeOrVersion.toLowerCase();
  if (type === "auto" || type === "detect") {
    type = detectBumpTypeFromGit();
    console.log(`[Auto-Detect] Analyzed git commits -> Determined bump type: ${type.toUpperCase()}`);
  }

  switch (type) {
    case "major":
      return `${current.major + 1}.0.0`;
    case "minor":
      return `${current.major}.${current.minor + 1}.0`;
    case "patch":
      return `${current.major}.${current.minor}.${current.patch + 1}`;
    default:
      throw new Error(`Unknown bump type: ${bumpTypeOrVersion}. Use major, minor, patch, auto, or a version string.`);
  }
}

function generateReleaseNotes(newVersion) {
  const range = getGitRange();
  let log = "";
  try {
    log = execSync(`git log ${range} --pretty=format:"- %s (%h)"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch (err) {
    log = execSync(`git log -n 5 --pretty=format:"- %s (%h)"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  }

  const lines = log.split("\n").filter(Boolean);
  const features = lines.filter((l) => /^- feat/i.test(l));
  const fixes = lines.filter((l) => /^- fix/i.test(l));
  const security = lines.filter((l) => /^- (sec|audit|auth|rbac)/i.test(l));
  const other = lines.filter(
    (l) => !/^- (feat|fix|sec|audit|auth|rbac)/i.test(l) && !l.includes("chore(release):"),
  );

  let md = `# Release v${newVersion}\n\n`;
  md += `**Release Date**: ${new Date().toISOString().split("T")[0]}\n\n`;
  if (features.length > 0) {
    md += `### 🚀 Features\n${features.join("\n")}\n\n`;
  }
  if (fixes.length > 0) {
    md += `### 🐛 Bug Fixes\n${fixes.join("\n")}\n\n`;
  }
  if (security.length > 0) {
    md += `### 🔒 Security & Access Control\n${security.join("\n")}\n\n`;
  }
  if (other.length > 0) {
    md += `### 🛠 Other Updates\n${other.join("\n")}\n\n`;
  }

  fs.writeFileSync(path.join(ROOT_DIR, "RELEASE_NOTES.md"), md);
  console.log(`Generated release notes at RELEASE_NOTES.md`);
}

function main() {
  const arg = process.argv[2] || "patch";
  const rootPkgPath = path.join(ROOT_DIR, "package.json");
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
  const currentVersion = rootPkg.version || "1.0.0";

  const newVersion = computeNewVersion(currentVersion, arg);

  console.log(`Bumping monorepo packages from ${currentVersion} -> ${newVersion}`);

  let updatedCount = 0;
  for (const pkgPath of PACKAGE_JSON_PATHS) {
    if (fs.existsSync(pkgPath)) {
      const content = fs.readFileSync(pkgPath, "utf8");
      const json = JSON.parse(content);
      const prev = json.version;
      json.version = newVersion;
      fs.writeFileSync(pkgPath, JSON.stringify(json, null, 2) + "\n");
      const relPath = path.relative(ROOT_DIR, pkgPath);
      console.log(`  ✓ ${relPath}: ${prev} -> ${newVersion}`);
      updatedCount++;
    }
  }

  console.log(`\nSuccessfully bumped ${updatedCount} packages to version ${newVersion}`);

  generateReleaseNotes(newVersion);

  // Output new version to stdout or GitHub Output if running in actions
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_version=${newVersion}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_tag=v${newVersion}\n`);
  }
}

main();
