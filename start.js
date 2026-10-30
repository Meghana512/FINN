import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverDir = path.join(__dirname, "finn-intelligence", "server");
const clientDir = path.join(__dirname, "finn-intelligence", "client");

console.log("Starting FINN backend & frontend...");

const server = spawn("npm", ["run", "dev"], {
  cwd: serverDir,
  shell: true,
  stdio: "inherit"
});

const client = spawn("npm", ["run", "dev"], {
  cwd: clientDir,
  shell: true,
  stdio: "inherit"
});

const cleanup = () => {
  server.kill();
  client.kill();
  process.exit();
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
