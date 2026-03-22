import net from "node:net";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[wait-for-db] DATABASE_URL is not set.");
  process.exit(1);
}

const url = new URL(databaseUrl);
const host = url.hostname;
const port = Number(url.port || 5432);
const timeoutMs = Number(process.env.DB_WAIT_TIMEOUT_MS || 60000);
const intervalMs = Number(process.env.DB_WAIT_INTERVAL_MS || 2000);
const deadline = Date.now() + timeoutMs;

function tryConnect() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });

    const cleanup = () => {
      socket.removeAllListeners();
      socket.end();
      socket.destroy();
    };

    socket.setTimeout(3000);
    socket.once("connect", () => {
      cleanup();
      resolve(undefined);
    });
    socket.once("timeout", () => {
      cleanup();
      reject(new Error("timeout"));
    });
    socket.once("error", (error) => {
      cleanup();
      reject(error);
    });
  });
}

while (Date.now() < deadline) {
  try {
    await tryConnect();
    console.log(`[wait-for-db] PostgreSQL is reachable at ${host}:${port}.`);
    process.exit(0);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.log(`[wait-for-db] Still waiting for ${host}:${port} (${detail})...`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

console.error(`[wait-for-db] Timed out after ${timeoutMs}ms while waiting for ${host}:${port}.`);
process.exit(1);
