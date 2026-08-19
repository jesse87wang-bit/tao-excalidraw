#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = path.join(repoRoot, "skills", "tao-excalidraw");
const requiredRootFiles = ["LICENSE", "README.md"];
const requiredFiles = [
  "SKILL.md",
  "agents/openai.yaml",
  "assets/layout-reference.png",
  "assets/style-anchor.png",
  "references/delivery-spec.md",
  "references/visual-spec.md",
  "scripts/validate-excalidraw-defaults.mjs",
  "scripts/validate-tao-layout.mjs",
];

const failures = [];
const fail = (message) => failures.push(message);

for (const relativePath of requiredRootFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    fail(`missing required root file: ${relativePath}`);
  }
}

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(skillRoot, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    fail(`missing required file: ${relativePath}`);
  }
}

const skillPath = path.join(skillRoot, "SKILL.md");
if (fs.existsSync(skillPath)) {
  const skillText = fs.readFileSync(skillPath, "utf8");
  const frontmatter = skillText.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!frontmatter) {
    fail("SKILL.md has no YAML frontmatter");
  } else {
    if (!/^name:\s*tao-excalidraw\s*$/m.test(frontmatter[1])) {
      fail("SKILL.md frontmatter name must be tao-excalidraw");
    }
    if (!/^description:\s*\S.+$/m.test(frontmatter[1])) {
      fail("SKILL.md frontmatter needs a non-empty description");
    }
    if (!/^license:\s*MIT\s*$/m.test(frontmatter[1])) {
      fail("SKILL.md frontmatter license must be MIT");
    }
  }
}

let totalBytes = 0;
const textExtensions = new Set([".md", ".mjs", ".js", ".json", ".yaml", ".yml", ".txt"]);
const forbiddenSecrets = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["'][^"']{8,}["']/i,
];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(repoRoot, absolutePath);

    if (entry.isSymbolicLink()) {
      fail(`symbolic link is not allowed in the release: ${relativePath}`);
      continue;
    }
    if (entry.isDirectory()) {
      if (entry.name === "private" || entry.name === ".private") {
        fail(`private directory must not be published: ${relativePath}`);
        continue;
      }
      if (entry.name === ".git") continue;
      walk(absolutePath);
      continue;
    }
    if (!entry.isFile()) continue;

    const stat = fs.statSync(absolutePath);
    totalBytes += stat.size;
    if ((stat.mode & 0o004) === 0) {
      fail(`file is not world-readable: ${relativePath}`);
    }

    if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
      const text = fs.readFileSync(absolutePath, "utf8");
      if (/\/Users\/[A-Za-z0-9._-]+\//.test(text)) {
        fail(`user-specific absolute path found: ${relativePath}`);
      }
      for (const pattern of forbiddenSecrets) {
        if (pattern.test(text)) fail(`possible secret found: ${relativePath}`);
      }
    }
  }
}

walk(repoRoot);

const maxReleaseBytes = 25 * 1024 * 1024;
if (totalBytes > maxReleaseBytes) {
  fail(`release is too large: ${totalBytes} bytes (limit ${maxReleaseBytes})`);
}

for (const relativePath of [
  "scripts/validate-excalidraw-defaults.mjs",
  "scripts/validate-tao-layout.mjs",
]) {
  const result = spawnSync(process.execPath, ["--check", path.join(skillRoot, relativePath)], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    fail(`${relativePath} failed node --check: ${result.stderr.trim()}`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log(`tao-excalidraw release OK: ${requiredFiles.length} required files, ${totalBytes} bytes`);
