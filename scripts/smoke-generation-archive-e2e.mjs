import http from "node:http";
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const nextPort = Number(process.env.NEXT_SMOKE_PORT || 3117);
const providerPort = Number(process.env.MOCK_PROVIDER_PORT || 3125);
const loopbackAlias = process.env.SMOKE_LOOPBACK_HOST || "localhost.localstack.cloud";

const baseUrl = `http://localhost:${nextPort}`;
const providerBaseUrl = `http://${loopbackAlias}:${providerPort}/v1`;
const nextBin = "node_modules/next/dist/bin/next";
const archiveInstruction = "请生成一份足够长的港口商战世界设定，用于对象存储归档 smoke。";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSetCookie(header) {
  if (!header) {
    return [];
  }

  if (Array.isArray(header)) {
    return header.map((item) => item.split(";")[0]);
  }

  return String(header)
    .split(/,(?=[^;]+=[^;]+)/)
    .map((item) => item.split(";")[0].trim())
    .filter(Boolean);
}

async function fetchJson(url, options = {}, cookies = []) {
  const headers = {
    origin: baseUrl,
    ...(options.headers || {}),
  };

  if (cookies.length) {
    headers.cookie = cookies.join("; ");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const setCookie = response.headers.get("set-cookie");
  const nextCookies = parseSetCookie(setCookie);
  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return {
    status: response.status,
    data,
    cookies: nextCookies,
  };
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function assertOk(response, label) {
  if (response.status >= 400) {
    throw new Error(`${label} failed: ${JSON.stringify(response.data)}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildLargeOutput() {
  const paragraph = "潮汐港同盟以夜航税票、浮仓契据和靠泊窗口构成三层收益栅栏，任何脱离账册的交易都会被潮口税警追缴。";
  return Array.from({ length: 220 }, (_, index) => `段落${index + 1}：${paragraph}`).join("\n\n");
}

function extractBodyText(body) {
  return JSON.stringify(body ?? {});
}

function buildResponseApiPayload(body, requestIndex) {
  const bodyText = extractBodyText(body);
  const output = bodyText.includes("Reply with exactly OK") ? "OK" : buildLargeOutput();
  const model = typeof body?.model === "string" ? body.model : "gpt-4o-mini";

  return {
    id: `resp_${requestIndex}`,
    created_at: Math.floor(Date.now() / 1000),
    model,
    output: [
      {
        type: "message",
        id: `msg_${requestIndex}`,
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: output,
            annotations: [],
          },
        ],
      },
    ],
    usage: {
      input_tokens: 256,
      output_tokens: 4096,
      total_tokens: 4352,
    },
  };
}

function buildChatCompletionPayload(body, requestIndex) {
  const bodyText = extractBodyText(body);
  const output = bodyText.includes("Reply with exactly OK") ? "OK" : buildLargeOutput();
  const model = typeof body?.model === "string" ? body.model : "gpt-4o-mini";

  return {
    id: `chatcmpl_${requestIndex}`,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: output,
          annotations: [],
        },
      },
    ],
    usage: {
      prompt_tokens: 256,
      completion_tokens: 4096,
      total_tokens: 4352,
    },
  };
}

function createMockProviderServer(state) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (request.method !== "POST") {
      response.writeHead(405, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Method not allowed." }));
      return;
    }

    const body = await readJsonBody(request);
    state.requests.push({
      path: url.pathname,
      headers: {
        authorization: request.headers.authorization ?? null,
      },
      body,
    });
    const requestIndex = state.requests.length;

    if (url.pathname === "/v1/responses") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(buildResponseApiPayload(body, requestIndex)));
      return;
    }

    if (url.pathname === "/v1/chat/completions") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(buildChatCompletionPayload(body, requestIndex)));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found." }));
  });
}

async function waitForServer() {
  for (let index = 0; index < 40; index += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) {
        return;
      }
    } catch {}

    await sleep(1000);
  }

  throw new Error(`Server at ${baseUrl} did not become ready.`);
}

async function ensureProductionBuild() {
  try {
    await access(".next/BUILD_ID");
  } catch {
    await new Promise((resolve, reject) => {
      const build = spawn(process.execPath, [nextBin, "build"], {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit",
      });

      build.on("exit", (code) => {
        if (code === 0) {
          resolve(undefined);
          return;
        }

        reject(new Error(`next build exited with code ${code}`));
      });

      build.on("error", reject);
    });
  }
}

async function listen(server, port, host = "0.0.0.0") {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve(undefined);
    });
  });
}

async function closeServer(server) {
  if (!server?.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(undefined);
    });
  });
}

function resolveLocalObjectPath(storageKey) {
  return path.join(process.cwd(), ".data", "object-store", ...storageKey.split("/"));
}

function findById(items, id, label) {
  const found = Array.isArray(items) ? items.find((item) => item.id === id) : null;

  if (!found) {
    throw new Error(`${label} not found.`);
  }

  return found;
}

async function main() {
  await ensureProductionBuild();

  const providerState = { requests: [] };
  const providerServer = createMockProviderServer(providerState);
  await listen(providerServer, providerPort);

  const child = spawn(process.execPath, [nextBin, "start", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_BASE_URL: baseUrl,
      BETTER_AUTH_URL: baseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForServer();

    const signup = await fetchJson(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Generation Archive Tester",
        email: `smoke-generation-archive-${Date.now()}@example.com`,
        password: "Passw0rd123!",
      }),
    });
    assertOk(signup, "signup");
    assert(signup.cookies.length > 0, "signup succeeded but no session cookie was returned.");

    const cookies = signup.cookies;
    const project = await fetchJson(
      `${baseUrl}/api/projects`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Smoke Generation Archive Project",
          genre: "历史商战",
          platform: "起点",
          status: "active",
        }),
      },
      cookies,
    );
    assertOk(project, "project creation");
    const projectId = project.data.project.id;

    const endpoint = await fetchJson(
      `${baseUrl}/api/provider-endpoints`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerType: "openai",
          label: "OpenAI Archive Smoke",
          baseURL: providerBaseUrl,
          authMode: "bearer",
          secret: "archive-smoke-key",
          extraHeaders: {},
          defaultModel: "gpt-4o-mini",
        }),
      },
      cookies,
    );
    assertOk(endpoint, "endpoint creation");

    const health = await fetchJson(
      `${baseUrl}/api/provider-endpoints/${endpoint.data.id}/health`,
      { method: "POST" },
      cookies,
    );
    assertOk(health, "provider health");
    assert(health.data.status === "healthy", "provider health probe did not return healthy.");

    const generate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskType: "generate_setting",
          userInstruction: archiveInstruction,
          endpointId: endpoint.data.id,
          modelId: "gpt-4o-mini",
          selectedArtifactIds: [],
          selectedReferenceIds: [],
          selectedMcpServerIds: [],
          generationOptions: {
            temperature: 0.2,
            maxTokens: 4096,
          },
        }),
      },
      cookies,
    );
    assertOk(generate, "generate");
    assert(generate.data.output.includes("潮汐港同盟"), "generate output did not include the expected archive marker.");

    const runs = await fetchJson(`${baseUrl}/api/projects/${projectId}/runs`, { method: "GET" }, cookies);
    assertOk(runs, "run listing");
    const run = findById(runs.data.items, generate.data.runId, "archived run");
    assert(typeof run.archiveStorageKey === "string" && run.archiveStorageKey.length > 0, "run archiveStorageKey was not persisted.");
    assert(run.archiveObjectStoreMode === "local", "archive smoke expected local object-store mode.");
    assert(typeof run.archiveByteSize === "number" && run.archiveByteSize > 12 * 1024, "archived byte size was too small.");
    assert(
      run.archiveContentType === "application/json; charset=utf-8",
      "archive content type did not persist.",
    );

    const archivePath = resolveLocalObjectPath(run.archiveStorageKey);
    await access(archivePath);
    const archiveDocument = JSON.parse(await readFile(archivePath, "utf8"));
    assert(archiveDocument.run.id === generate.data.runId, "archived run id did not match.");
    assert(archiveDocument.run.modelId === "gpt-4o-mini", "archived model id did not match.");
    assert(archiveDocument.draft.outputContent === generate.data.output, "archived draft output did not match.");
    assert(Array.isArray(archiveDocument.draft.suggestedPatches), "archived suggestedPatches were missing.");
    assert(providerState.requests.length >= 2, "mock provider did not receive health + generate requests.");

    console.log(
      JSON.stringify({
        baseUrl,
        projectId,
        endpointId: endpoint.data.id,
        runId: generate.data.runId,
        draftId: generate.data.draftId,
        archiveStorageKey: run.archiveStorageKey,
        archiveByteSize: run.archiveByteSize,
        objectStoreMode: run.archiveObjectStoreMode,
        providerRequestCount: providerState.requests.length,
      }),
    );
  } finally {
    child.kill("SIGTERM");
    await sleep(1000);

    if (!child.killed) {
      child.kill("SIGKILL");
    }

    await closeServer(providerServer);

    if (stderr.trim()) {
      process.stderr.write(stderr);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
