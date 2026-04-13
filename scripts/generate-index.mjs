#!/usr/bin/env node
/**
 * generate-index.mjs — regenerate index.json from all plugins/*/metadata.json.
 *
 * Output: index.json at the repo root (deployed to GitHub Pages).
 * Format matches what the coording app expects:
 * { schemaVersion: "2", plugins: [...] }
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const PLUGINS_DIR = "plugins";
const OUTPUT = "index.json";

const entries = readdirSync(PLUGINS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("."))
  .map((d) => {
    const metadataPath = join(PLUGINS_DIR, d.name, "metadata.json");
    if (!existsSync(metadataPath)) {
      console.warn(`⚠️  Skipping ${d.name} — no metadata.json`);
      return null;
    }
    try {
      return JSON.parse(readFileSync(metadataPath, "utf-8"));
    } catch (e) {
      console.error(`❌ Failed to parse ${metadataPath}: ${e.message}`);
      return null;
    }
  })
  .filter(Boolean)
  .sort((a, b) => a.id.localeCompare(b.id));

const index = {
  schemaVersion: "2",
  generatedAt: new Date().toISOString(),
  plugins: entries,
};

writeFileSync(OUTPUT, JSON.stringify(index, null, 2) + "\n");
console.log(`✅ Generated ${OUTPUT} with ${entries.length} plugin(s).`);
