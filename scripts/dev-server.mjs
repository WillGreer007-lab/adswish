// Spawn `npm run dev` detached (own session) so it survives the terminal tool's
// process-group cleanup. Logs go to /tmp/adswish-dev.log; port pinned to 3000.
import { spawn } from "node:child_process";
import { openSync } from "node:fs";

const log = openSync("/tmp/adswish-dev.log", "a");
const child = spawn("npm", ["run", "dev"], {
  detached: true,
  stdio: ["ignore", log, log],
  env: { ...process.env, PORT: "3000" },
});
child.unref();
console.log(`spawned pid=${child.pid}`);
