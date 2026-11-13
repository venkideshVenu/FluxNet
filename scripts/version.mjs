#!/usr/bin/env node
// Keeps the app version identical in the three files that declare it.
//
//   node scripts/version.mjs check          fail if the versions differ
//   node scripts/version.mjs check v1.2.3   ...or differ from a release tag
//   node scripts/version.mjs set 1.2.3      write a new version to all three
//
// After `set`, run `cargo check` (or any cargo build) in src-tauri so
// Cargo.lock picks up the new version, and commit all four files together.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
// The first `version = "..."` in Cargo.toml belongs to [package].
const CARGO_VERSION = /^version\s*=\s*"([^"]+)"/m;

const files = {
  "package.json": {
    read: (text) => JSON.parse(text).version,
    write: (text, v) => text.replace(/("version":\s*)"[^"]+"/, `$1"${v}"`),
  },
  "src-tauri/tauri.conf.json": {
    read: (text) => JSON.parse(text).version,
    write: (text, v) => text.replace(/("version":\s*)"[^"]+"/, `$1"${v}"`),
  },
  "src-tauri/Cargo.toml": {
    read: (text) => text.match(CARGO_VERSION)?.[1],
    write: (text, v) => text.replace(CARGO_VERSION, `version = "${v}"`),
  },
};

const load = (path) => readFileSync(join(root, path), "utf8");

function versions() {
  return Object.entries(files).map(([path, f]) => [path, f.read(load(path))]);
}

function check(tag) {
  const found = versions();
  const expected = tag ? tag.replace(/^v/, "") : found[0][1];
  const bad = found.filter(([, v]) => v !== expected);
  if (bad.length > 0) {
    const source = tag ? `tag ${tag}` : "package.json";
    console.error(`Version mismatch (expected ${expected}, from ${source}):`);
    for (const [path, v] of found) console.error(`  ${path}: ${v}`);
    process.exit(1);
  }
  console.log(`All versions are ${expected}.`);
}

function set(version) {
  if (!SEMVER.test(version ?? "")) {
    console.error(`Not a semantic version: ${version ?? "(missing)"}`);
    process.exit(1);
  }
  for (const [path, f] of Object.entries(files)) {
    writeFileSync(join(root, path), f.write(load(path), version));
  }
  check();
}

const [command, arg] = process.argv.slice(2);
if (command === "check") check(arg);
else if (command === "set") set(arg);
else {
  console.error("Usage: node scripts/version.mjs check [tag] | set <version>");
  process.exit(1);
}
