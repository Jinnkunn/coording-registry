#!/usr/bin/env node
// validate.mjs -- validate plugin metadata entries
// Usage: node scripts/validate.mjs [plugins/my-plugin]

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const SCHEMA = JSON.parse(readFileSync("schema/metadata.schema.json", "utf-8"));
const REQUIRED_FIELDS = SCHEMA.required;

let hasErrors = false;

function error(pluginId, message) {
  console.error(`  ❌ [${pluginId}] ${message}`);
  hasErrors = true;
}

function ok(pluginId, message) {
  console.log(`  ✅ [${pluginId}] ${message}`);
}

function warn(pluginId, message) {
  console.warn(`  ⚠️  [${pluginId}] ${message}`);
}

function parseSemver(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function semverGt(a, b) {
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch > b.patch;
}

function getPreviousVersion(pluginDir) {
  try {
    const result = execSync(
      `git show HEAD:${pluginDir}/metadata.json 2>/dev/null`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
    const prev = JSON.parse(result);
    return prev.version;
  } catch {
    return null; // new plugin, no previous version
  }
}

async function validatePlugin(pluginDir) {
  const dirName = basename(pluginDir);
  const metadataPath = join(pluginDir, "metadata.json");

  if (!existsSync(metadataPath)) {
    error(dirName, `metadata.json not found at ${metadataPath}`);
    return;
  }

  // 1. Parse JSON
  let metadata;
  try {
    metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
  } catch (e) {
    error(dirName, `Invalid JSON: ${e.message}`);
    return;
  }

  // 2. Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!metadata[field]) {
      error(dirName, `Missing required field: ${field}`);
    }
  }
  if (hasErrors) return;

  // 3. ID matches directory name
  if (metadata.id !== dirName) {
    error(dirName, `metadata.id "${metadata.id}" does not match directory name "${dirName}"`);
  }

  // 4. ID format
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(metadata.id)) {
    error(dirName, `Invalid plugin ID format: "${metadata.id}" (must be kebab-case)`);
  }

  // 5. Semver
  const sv = parseSemver(metadata.version);
  if (!sv) {
    error(dirName, `Invalid semver: "${metadata.version}"`);
  } else {
    ok(dirName, `Version: ${metadata.version}`);
  }

  // 6. Semver must increment
  if (sv) {
    const prevVersion = getPreviousVersion(pluginDir);
    if (prevVersion) {
      const prevSv = parseSemver(prevVersion);
      if (prevSv && !semverGt(sv, prevSv)) {
        error(dirName, `Version ${metadata.version} must be greater than previous ${prevVersion}`);
      } else if (prevSv) {
        ok(dirName, `Version incremented: ${prevVersion} → ${metadata.version}`);
      }
    } else {
      ok(dirName, "New plugin (no previous version)");
    }
  }

  // 7. downloadUrl reachable
  if (metadata.downloadUrl) {
    try {
      const response = await fetch(metadata.downloadUrl, { method: "HEAD", redirect: "follow" });
      if (response.ok) {
        ok(dirName, `Download URL reachable: ${response.status}`);
      } else {
        error(dirName, `Download URL returned ${response.status}: ${metadata.downloadUrl}`);
      }
    } catch (e) {
      error(dirName, `Download URL unreachable: ${e.message}`);
    }
  }

  // 8. SHA256 verification (if provided, downloads the full file)
  if (metadata.sha256 && metadata.downloadUrl) {
    try {
      const response = await fetch(metadata.downloadUrl, { redirect: "follow" });
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const hash = createHash("sha256").update(buffer).digest("hex");
        if (hash === metadata.sha256) {
          ok(dirName, `SHA256 verified: ${hash.slice(0, 16)}…`);
        } else {
          error(dirName, `SHA256 mismatch: expected ${metadata.sha256.slice(0, 16)}… got ${hash.slice(0, 16)}…`);
        }
      }
    } catch (e) {
      warn(dirName, `Could not verify SHA256: ${e.message}`);
    }
  } else if (!metadata.sha256) {
    warn(dirName, "No sha256 provided — recommend adding for integrity verification");
  }

  // 9. No unknown fields
  const knownFields = new Set(Object.keys(SCHEMA.properties));
  for (const key of Object.keys(metadata)) {
    if (!knownFields.has(key)) {
      warn(dirName, `Unknown field: "${key}"`);
    }
  }
}

// --- Main ---

const targetDir = process.argv[2];
const pluginDirs = targetDir
  ? [targetDir]
  : readdirSync("plugins", { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => join("plugins", d.name));

if (pluginDirs.length === 0) {
  console.log("No plugins to validate.");
  process.exit(0);
}

console.log(`Validating ${pluginDirs.length} plugin(s)…\n`);

for (const dir of pluginDirs) {
  console.log(`📦 ${basename(dir)}`);
  await validatePlugin(dir);
  console.log();
}

if (hasErrors) {
  console.error("\n❌ Validation failed — see errors above.");
  process.exit(1);
} else {
  console.log("\n✅ All plugins validated successfully.");
}
