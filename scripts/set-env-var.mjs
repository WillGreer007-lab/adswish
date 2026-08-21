#!/usr/bin/env node
// Usage: node scripts/set-env-var.mjs KEY VALUE [KEY VALUE ...]
// Sets (or appends) the given keys in .env.local and vercel-env.txt.
// Never prints values — it only confirms which files were updated.
import { readFileSync, writeFileSync } from "node:fs";

const files = [".env.local", "vercel-env.txt"];
const args = process.argv.slice(2);
if (args.length === 0 || args.length % 2 !== 0) {
  console.error("Usage: node scripts/set-env-var.mjs KEY VALUE [KEY VALUE ...]");
  process.exit(1);
}

const pairs = [];
for (let i = 0; i < args.length; i += 2) {
  pairs.push([args[i], args[i + 1]]);
}

function upsert(text, key, value) {
  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  const line = `${key}=${value}`;
  if (idx >= 0) lines[idx] = line;
  else lines.push(line);
  return lines.join("\n");
}

for (const file of files) {
  let text = readFileSync(file, "utf8");
  for (const [key, value] of pairs) text = upsert(text, key, value);
  writeFileSync(file, text.endsWith("\n") ? text : text + "\n");
  console.log(`updated ${file}`);
}
