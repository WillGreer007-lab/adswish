import fs from "node:fs";

function ensureKey(path, key, value, comment) {
  if (!fs.existsSync(path)) return console.log(`skip ${path} (missing)`);
  let text = fs.readFileSync(path, "utf8");
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) {
    text = text.replace(re, `${key}=${value}`);
    console.log(`${path}: updated ${key}`);
  } else {
    const block = `\n# --- ${comment} ---\n${key}=${value}\n`;
    text = text.endsWith("\n") ? text + block : text + "\n" + block;
    console.log(`${path}: added ${key}`);
  }
  fs.writeFileSync(path, text);
}

// Local dev: localhost. Production (vercel-env.txt is what gets pasted into Vercel): live domain.
ensureKey(".env.local", "NEXT_PUBLIC_APP_URL", "http://localhost:3000", "Public app URL (dev)");
ensureKey("vercel-env.txt", "NEXT_PUBLIC_APP_URL", "https://adswish-lake.vercel.app", "Public app URL (production — change when a custom domain is connected)");

console.log("\nDone. NEXT_PUBLIC_APP_URL is now set in both files.");
