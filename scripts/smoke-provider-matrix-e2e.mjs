import http from "node:http";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import process from "node:process";

const nextPort = Number(process.env.NEXT_SMOKE_PORT || 3116);
const geminiPort = Number(process.env.MOCK_GEMINI_PROVIDER_PORT || 3124);
const anthropicPort = Number(process.env.MOCK_ANTHROPIC_PROVIDER_PORT || 3134);
const loopbackAlias = process.env.SMOKE_LOOPBACK_HOST || "localhost.localstack.cloud";

const baseUrl = `http://localhost:${nextPort}`;
const geminiBaseUrl = `http://${loopbackAlias}:${geminiPort}/v1beta`;
const anthropicBaseUrl = `http://${loopbackAlias}:${anthropicPort}/v1`;
const nextBin = "node_modules/next/dist/bin/next";

const anthropicWorkflowInstruction = "Anthropic smoke: 请审查当前项目工作流是否具备下一步写作条件。";
const geminiSettingInstruction = "Gemini smoke: 请补齐港口商战题材的世界规则、收益链和限制条件。";
const anthropicWorkflowMarker = "Anthropic 工作流检查通过：当前项目已具备进入设定细化与章节续写的条件。";
const geminiSettingMarker = "Gemini 设定补全：潮汐港同盟通过夜航税票和仓位让渡维持收益秩序。";

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

function extractBodyText(body) {
  return JSON.stringify(body ?? {});
}

function buildAnthropicOutput(body) {
  const bodyText = extractBodyText(body);

  if (bodyText.includes("Reply with exactly OK")) {
    return "OK";
  }

  if (bodyText.includes(anthropicWorkflowInstruction)) {
    return [
      "# 工作流检查",
      "",
      `- ${anthropicWorkflowMarker}`,
      "- 当前 artifact 基础齐备，可进入设定补强与后续章节生成。",
      "- 建议下一步：generate_setting -> generate_outline。",
    ].join("\n");
  }

  return "Anthropic smoke response.";
}

function buildGeminiOutput(body) {
  const bodyText = extractBodyText(body);

  if (bodyText.includes("Reply with exactly OK")) {
    return "OK";
  }

  if (bodyText.includes(geminiSettingInstruction)) {
    return [
      "# 世界设定补全",
      "",
      `- ${geminiSettingMarker}`,
      "- 潮汐港的夜航仓位与税票核验绑定，任何绕开官埠账册的装卸都会被视为违约。",
      "- 主角的优势来自对税契、仓位和到账周期的拆解，而不是超凡能力。",
    ].join("\n");
  }

  return "Gemini smoke response.";
}

function createAnthropicServer(state) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const body = await readJsonBody(request);

    state.requests.push({
      path: url.pathname,
      body,
      headers: {
        "x-api-key": request.headers["x-api-key"] ?? null,
        "anthropic-version": request.headers["anthropic-version"] ?? null,
      },
    });

    if (request.method !== "POST" || url.pathname !== "/v1/messages") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found." }));
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        type: "message",
        id: `msg_${state.requests.length}`,
        model: body?.model ?? "claude-smoke",
        content: [
          {
            type: "text",
            text: buildAnthropicOutput(body),
          },
        ],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: 32,
          output_tokens: 18,
        },
      }),
    );
  });
}

function createGeminiServer(state) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const body = await readJsonBody(request);

    state.requests.push({
      path: url.pathname,
      body,
      headers: {
        "x-goog-api-key": request.headers["x-goog-api-key"] ?? null,
      },
    });

    if (request.method !== "POST" || !url.pathname.startsWith("/v1beta/models/") || !url.pathname.endsWith(":generateContent")) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found." }));
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: buildGeminiOutput(body),
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 28,
          candidatesTokenCount: 20,
          totalTokenCount: 48,
        },
      }),
    );
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

function findById(items, id, label) {
  const found = Array.isArray(items) ? items.find((item) => item.id === id) : null;

  if (!found) {
    throw new Error(`${label} not found.`);
  }

  return found;
}

async function main() {
  await ensureProductionBuild();

  const anthropicState = { requests: [] };
  const geminiState = { requests: [] };
  const anthropicServer = createAnthropicServer(anthropicState);
  const geminiServer = createGeminiServer(geminiState);

  await Promise.all([listen(anthropicServer, anthropicPort), listen(geminiServer, geminiPort)]);

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
        name: "Smoke Provider Matrix Tester",
        email: `smoke-provider-matrix-${Date.now()}@example.com`,
        password: "Passw0rd123!",
      }),
    });
    assertOk(signup, "signup");
    assert(signup.cookies.length > 0, "signup succeeded but no session cookie was returned.");

    const cookies = signup.cookies;

    const anthropicEndpoint = await fetchJson(
      `${baseUrl}/api/provider-endpoints`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerType: "anthropic",
          label: "Anthropic Custom URL Smoke",
          baseURL: anthropicBaseUrl,
          authMode: "bearer",
          secret: "anthropic-smoke-key",
          extraHeaders: {},
          defaultModel: "claude-health-smoke",
        }),
      },
      cookies,
    );
    assertOk(anthropicEndpoint, "anthropic endpoint creation");

    const geminiEndpoint = await fetchJson(
      `${baseUrl}/api/provider-endpoints`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerType: "gemini",
          label: "Gemini Custom URL Smoke",
          baseURL: geminiBaseUrl,
          authMode: "bearer",
          secret: "gemini-smoke-key",
          extraHeaders: {},
          defaultModel: "gemini-health-smoke",
        }),
      },
      cookies,
    );
    assertOk(geminiEndpoint, "gemini endpoint creation");

    const anthropicHealth = await fetchJson(
      `${baseUrl}/api/provider-endpoints/${anthropicEndpoint.data.id}/health`,
      { method: "POST" },
      cookies,
    );
    assertOk(anthropicHealth, "anthropic health");
    assert(anthropicHealth.data.status === "healthy", "anthropic health probe did not return healthy.");

    const geminiHealth = await fetchJson(
      `${baseUrl}/api/provider-endpoints/${geminiEndpoint.data.id}/health`,
      { method: "POST" },
      cookies,
    );
    assertOk(geminiHealth, "gemini health");
    assert(geminiHealth.data.status === "healthy", "gemini health probe did not return healthy.");

    const endpointsList = await fetchJson(`${baseUrl}/api/provider-endpoints`, { method: "GET" }, cookies);
    assertOk(endpointsList, "endpoint listing");
    const persistedAnthropic = findById(endpointsList.data.items, anthropicEndpoint.data.id, "persisted anthropic endpoint");
    const persistedGemini = findById(endpointsList.data.items, geminiEndpoint.data.id, "persisted gemini endpoint");
    assert(persistedAnthropic.healthStatus === "healthy", "anthropic health status did not persist.");
    assert(persistedGemini.healthStatus === "healthy", "gemini health status did not persist.");

    const project = await fetchJson(
      `${baseUrl}/api/projects`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Smoke Provider Matrix Project",
          genre: "历史商战",
          platform: "起点",
          status: "active",
        }),
      },
      cookies,
    );
    assertOk(project, "project creation");

    const projectId = project.data.project.id;

    const anthropicGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskType: "workflow_check",
          userInstruction: anthropicWorkflowInstruction,
          endpointId: anthropicEndpoint.data.id,
          modelId: "claude-generate-smoke",
          selectedArtifactIds: [],
          selectedReferenceIds: [],
          selectedMcpServerIds: [],
          generationOptions: {
            temperature: 0,
            maxTokens: 900,
          },
        }),
      },
      cookies,
    );
    assertOk(anthropicGenerate, "anthropic generate");
    assert(
      anthropicGenerate.data.output.includes(anthropicWorkflowMarker),
      "anthropic generate output did not include the expected marker.",
    );

    const geminiGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskType: "generate_setting",
          userInstruction: geminiSettingInstruction,
          endpointId: geminiEndpoint.data.id,
          modelId: "gemini-generate-smoke",
          selectedArtifactIds: [],
          selectedReferenceIds: [],
          selectedMcpServerIds: [],
          generationOptions: {
            temperature: 0.2,
            maxTokens: 1100,
          },
        }),
      },
      cookies,
    );
    assertOk(geminiGenerate, "gemini generate");
    assert(
      geminiGenerate.data.output.includes(geminiSettingMarker),
      "gemini generate output did not include the expected marker.",
    );

    const runs = await fetchJson(`${baseUrl}/api/projects/${projectId}/runs`, { method: "GET" }, cookies);
    assertOk(runs, "run listing");
    const anthropicRun = findById(runs.data.items, anthropicGenerate.data.runId, "anthropic run");
    const geminiRun = findById(runs.data.items, geminiGenerate.data.runId, "gemini run");
    assert(anthropicRun.endpointId === anthropicEndpoint.data.id, "anthropic run endpointId did not persist.");
    assert(anthropicRun.modelId === "claude-generate-smoke", "anthropic run modelId did not persist.");
    assert(geminiRun.endpointId === geminiEndpoint.data.id, "gemini run endpointId did not persist.");
    assert(geminiRun.modelId === "gemini-generate-smoke", "gemini run modelId did not persist.");

    const drafts = await fetchJson(`${baseUrl}/api/projects/${projectId}/drafts`, { method: "GET" }, cookies);
    assertOk(drafts, "draft listing");
    const anthropicDraft = findById(drafts.data.items, anthropicGenerate.data.draftId, "anthropic draft");
    const geminiDraft = findById(drafts.data.items, geminiGenerate.data.draftId, "gemini draft");
    assert(anthropicDraft.taskType === "workflow_check", "anthropic draft taskType did not persist.");
    assert(geminiDraft.taskType === "generate_setting", "gemini draft taskType did not persist.");

    assert(anthropicState.requests.length === 2, "anthropic custom URL did not receive health + generate requests.");
    assert(geminiState.requests.length === 2, "gemini custom URL did not receive health + generate requests.");

    const [anthropicProbeRequest, anthropicGenerateRequest] = anthropicState.requests;
    assert(anthropicProbeRequest.path === "/v1/messages", "anthropic health probe path was unexpected.");
    assert(anthropicGenerateRequest.path === "/v1/messages", "anthropic generate path was unexpected.");
    assert(anthropicProbeRequest.body?.model === "claude-health-smoke", "anthropic health probe model was unexpected.");
    assert(
      anthropicGenerateRequest.body?.model === "claude-generate-smoke",
      "anthropic generate model did not reach the custom Anthropic server.",
    );
    assert(
      anthropicProbeRequest.headers["x-api-key"] === "anthropic-smoke-key",
      "anthropic custom URL request did not send x-api-key.",
    );
    assert(
      anthropicProbeRequest.headers["anthropic-version"] === "2023-06-01",
      "anthropic version header was not forwarded.",
    );

    const [geminiProbeRequest, geminiGenerateRequest] = geminiState.requests;
    assert(
      geminiProbeRequest.path === "/v1beta/models/gemini-health-smoke:generateContent",
      "gemini health probe path was unexpected.",
    );
    assert(
      geminiGenerateRequest.path === "/v1beta/models/gemini-generate-smoke:generateContent",
      "gemini generate path was unexpected.",
    );
    assert(
      geminiProbeRequest.headers["x-goog-api-key"] === "gemini-smoke-key",
      "gemini custom URL request did not send x-goog-api-key.",
    );

    console.log(
      JSON.stringify({
        baseUrl,
        projectId,
        anthropicEndpointId: anthropicEndpoint.data.id,
        geminiEndpointId: geminiEndpoint.data.id,
        anthropicRunId: anthropicGenerate.data.runId,
        geminiRunId: geminiGenerate.data.runId,
        anthropicRequestCount: anthropicState.requests.length,
        geminiRequestCount: geminiState.requests.length,
      }),
    );
  } finally {
    child.kill("SIGTERM");
    await sleep(1000);

    if (!child.killed) {
      child.kill("SIGKILL");
    }

    await Promise.all([closeServer(anthropicServer), closeServer(geminiServer)]);

    if (stderr.trim()) {
      process.stderr.write(stderr);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
