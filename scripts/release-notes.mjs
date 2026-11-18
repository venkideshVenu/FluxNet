#!/usr/bin/env node
// Prints the release notes for one version: its CHANGELOG.md section plus
// install instructions. Used by the release workflow.
//
//   node scripts/release-notes.mjs 0.2.0 > notes.md

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const version = (process.argv[2] ?? "").replace(/^v/, "");
if (!version) {
  console.error("Usage: node scripts/release-notes.mjs <version>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");

const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const heading = new RegExp(`^## \\[${escaped}\\][^\\n]*\\n`, "m");
const match = heading.exec(changelog);
if (!match) {
  console.error(`CHANGELOG.md has no "## [${version}]" section.`);
  process.exit(1);
}
const rest = changelog.slice(match.index + match[0].length);
const end = rest.search(/^## \[|^\[[^\]]+\]: /m);
const section = (end === -1 ? rest : rest.slice(0, end)).trim();

process.stdout.write(`${section}

## Install

Download \`FluxNet_${version}_x64-setup.exe\` below and run it. It installs for
your user only and doesn't need administrator rights. Upgrading keeps your
usage history, settings and widget positions.

The installer isn't code-signed yet, so Windows SmartScreen may say "Windows
protected your PC". Choose **More info**, then **Run anyway**. To check the
download, compare the output of
\`Get-FileHash .\\FluxNet_${version}_x64-setup.exe\` with \`SHA256SUMS.txt\`.

Requires 64-bit Windows 10 or 11.
`);
