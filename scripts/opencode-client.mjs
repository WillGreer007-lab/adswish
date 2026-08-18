#!/usr/bin/env node
/**
 * Minimal OpenCode HTTP client.
 *
 * Talks to an `opencode serve` instance over its HTTP API (see
 * https://opencode.ai/docs/server/). The Freebuff desktop app (or any other
 * tool) can drive a running OpenCode agent through this script.
 *
 * Usage:
 *   node scripts/opencode-client.mjs discover
 *   node scripts/opencode-client.mjs ask "your prompt"
 *   node scripts/opencode-client.mjs ask --session <sessionId> "continue from here"
 *
 * Connection is configured via env vars (the `discover` command prints them):
 *   OPENCODE_URL              e.g. http://127.0.0.1:64221  (default)
 *   OPENCODE_SERVER_PASSWORD  basic-auth password for the server
 *   OPENCODE_USERNAME         basic-auth username (default: "opencode")
 *   OPENCODE_MODEL            "providerID/modelID" (default: opencode/deepseek-v4-flash-free,
 *                             a cloud model — NOT the local Ollama default).
 *                             Set to "default" to use the server's configured default.
 */
import { execSync } from "node:child_process";

const url = process.env.OPENCODE_URL ?? "http://127.0.0.1:64221";
const password = process.env.OPENCODE_SERVER_PASSWORD ?? "";
const username = process.env.OPENCODE_USERNAME ?? "opencode";

const auth = Buffer.from(`${username}:${password}`).toString("base64");
const headers = {
  "content-type": "application/json",
  authorization: `Basic ${auth}`,
};

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${method} ${path}: ${text.slice(0, 300)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function textOf(parts) {
  return (parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

// Find a running `opencode serve` process and read its port + password from
// its own environment (the OpenCode desktop app starts one this way).
function discover() {
  const proc = execSync("pgrep -f 'opencode serve'")
    .toString()
    .trim()
    .split("\n")[0];
  if (!proc) throw new Error("No running `opencode serve` process found.");

  const env = execSync(`ps eww -p ${proc}`).toString();
  const passMatch = env.match(/OPENCODE_SERVER_PASSWORD=(\S+)/);
  const portMatch = execSync(
    `lsof -nP -a -p ${proc} -iTCP -sTCP:LISTEN`
  ).toString().match(/127\.0\.0\.1:(\d+)\s/);

  if (!passMatch) throw new Error("Server password not found in process env.");
  if (!portMatch) throw new Error("Server port not found via lsof.");

  return { port: portMatch[1], password: passMatch[1] };
}

function resolveModel() {
  const spec = process.env.OPENCODE_MODEL ?? "opencode/deepseek-v4-flash-free";
  if (spec === "default" || spec === "null") return null; // server default
  const slash = spec.indexOf("/");
  if (slash <= 0) throw new Error(`OPENCODE_MODEL must be "providerID/modelID", got "${spec}"`);
  return { providerID: spec.slice(0, slash), modelID: spec.slice(slash + 1) };
}

async function ask(prompt, sessionId) {
  // Default to a cloud model (opencode zen free tier) instead of the server's
  // Ollama default. Reusing a session's model can fail when that provider
  // isn't available on this server, so always resolve the model explicitly.
  const model = resolveModel();

  let session;
  if (sessionId) {
    session = { id: sessionId };
  } else {
    session = await api("/session", {
      method: "POST",
      body: { title: prompt.slice(0, 60) },
    });
  }

  const reply = await api(`/session/${session.id}/message`, {
    method: "POST",
    body: {
      model,
      parts: [{ type: "text", text: prompt }],
    },
  });

  const text = textOf(reply.parts);
  console.log(`[${reply.info?.providerID}/${reply.info?.modelID}] ${reply.info?.id}`);
  console.log(text || "(no text reply)");
  console.log(`\n# session: ${session.id}`);
}

const [cmd, ...rest] = process.argv.slice(2);

try {
  if (cmd === "discover") {
    const { port, password } = discover();
    console.log(`# OpenCode server found at http://127.0.0.1:${port}`);
    console.log(`export OPENCODE_URL=http://127.0.0.1:${port}`);
    console.log(`export OPENCODE_SERVER_PASSWORD=${password}`);
  } else if (cmd === "ask") {
    const i = rest.indexOf("--session");
    const sessionId = i >= 0 ? rest[i + 1] : undefined;
    const prompt = rest
      .filter((_, idx) => !(i >= 0 && (idx === i || idx === i + 1)))
      .join(" ");
    if (!prompt) throw new Error("Usage: opencode-client.mjs ask [--session <id>] \"prompt\"");
    await ask(prompt, sessionId);
  } else {
    throw new Error(`Unknown command "${cmd}". Use "discover" or "ask".`);
  }
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(1);
}
