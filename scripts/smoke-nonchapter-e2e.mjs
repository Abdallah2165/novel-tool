import http from "node:http";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import process from "node:process";

const nextPort = Number(process.env.NEXT_SMOKE_PORT || 3109);
const providerPort = Number(process.env.MOCK_PROVIDER_PORT || 3119);
const loopbackAlias = process.env.SMOKE_LOOPBACK_HOST || "localhost.localstack.cloud";

const baseUrl = `http://localhost:${nextPort}`;
const providerBaseUrl = `http://${loopbackAlias}:${providerPort}/v1`;
const nextBin = "node_modules/next/dist/bin/next";
const settingMarker = "潮汐钟契约";
const outlineMarker = "第一卷：港口起势";
const syncStateMarker = "当前状态已推进到可执行首章";

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

  if (cookies.length > 0) {
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

function findFirstMarkerIndex(haystack, markers) {
  return markers.reduce((lowest, marker) => {
    const index = haystack.indexOf(marker);
    if (index === -1) {
      return lowest;
    }

    return Math.min(lowest, index);
  }, Number.POSITIVE_INFINITY);
}

function detectTaskKind(body) {
  const haystack = extractBodyText(body);
  const matches = [
    {
      taskKind: "workflow_check",
      index: findFirstMarkerIndex(haystack, ["workflow_check", "工作流完整性检查", "流程检查", "缺失项", "下一步建议"]),
    },
    {
      taskKind: "generate_setting",
      index: findFirstMarkerIndex(haystack, ["generate_setting", "设定生成", "世界规则", settingMarker, "建议回填补丁"]),
    },
    {
      taskKind: "generate_outline",
      index: findFirstMarkerIndex(haystack, ["generate_outline", "卷纲与节拍表生成", "节拍表", "关键回收点"]),
    },
    {
      taskKind: "sync_state",
      index: findFirstMarkerIndex(haystack, ["sync_state", "状态回填", "需更新的文件清单", "同步摘要", syncStateMarker]),
    },
  ]
    .filter((item) => Number.isFinite(item.index))
    .sort((left, right) => left.index - right.index);

  return matches[0]?.taskKind ?? null;
}

function buildTaskOutput(taskKind) {
  switch (taskKind) {
    case "workflow_check":
      return [
        "当前已有项：",
        "- 已有 task_plan、progress、99_当前状态卡，可继续推进前置检查。",
        "",
        "缺失项：",
        "- findings 还缺一条对设定骨架是否可支撑正文的检查结论。",
        "",
        "风险项：",
        "- world_bible 仍是 bootstrap 占位内容，继续写正文前需要先补世界规则和约束。",
        "",
        "下一步建议：",
        "- 先执行 generate_setting 补齐世界观，再执行 generate_outline 锁定卷纲节拍。",
      ].join("\n");
    case "generate_setting":
      return [
        "# 世界设定补全",
        "",
        "## 世界规则",
        `九州城的港务体系以“${settingMarker}”为约束，夜间装卸、税契和仓位分配都围绕这套约定运转。`,
        "",
        "## 地图与地理",
        "九州城分为上游官埠、中段商栈和下游黑平码头三段，潮位变化直接影响各家势力的夜间收益。",
        "",
        "## 能力体系",
        "主角的优势不是超凡力量，而是对港务流程、仓单和抽成链的精准拆解。",
        "",
        "## 禁忌与限制",
        "任何公开违背潮汐钟契约的势力，都会在次日被官埠暂停优先靠港资格。",
        "",
        "## 建议回填补丁",
        "- world_bible.md",
      ].join("\n");
    case "generate_outline":
      return [
        `# ${outlineMarker}`,
        "",
        "## 卷纲",
        `主线围绕“${settingMarker}”展开，主角先借夜班仓位分配撬开港口利益链，再把对手逼到必须让出优先装卸窗口。`,
        "",
        "## 节拍表",
        "1. 发现港务契约漏洞，确认第一批可套利的夜间船次。",
        "2. 借让渡仓位换抽成，迫使对手暴露真实现金流压力。",
        "3. 通过官埠与商栈的双线博弈，完成第一轮势力站位。",
        "",
        "## 关键回收点",
        "- 回收世界规则里的潮汐钟契约，证明它既是秩序也是武器。",
        "- 在卷末把优先靠港资格与主角长期收益绑定，给下一卷留下扩张口子。",
        "",
        "## 需要更新的项目文件",
        "- task_plan.md",
      ].join("\n");
    case "sync_state":
      return [
        "# progress 同步结果",
        "",
        "## 进度记录",
        "| 时间 | 章节/节点 | 推进内容 | 待跟进 |",
        "| --- | --- | --- | --- |",
        `| 当前轮 | ${outlineMarker} | 已确认 ${settingMarker} 与港口收益链，卷纲进入可执行状态 | 执行首章写作前检查 |`,
        "",
        "## 需更新的文件清单",
        "- progress.md",
        "- 99_当前状态卡.md",
        "",
        "## 补丁内容",
        `- progress.md: 记录 ${settingMarker} 与 ${outlineMarker} 已经完成锁定。`,
        `- 99_当前状态卡.md: ${syncStateMarker}。`,
        "",
        "## 本次同步摘要",
        `- ${syncStateMarker}`,
      ].join("\n");
    default:
      return "Smoke health response.";
  }
}

function buildResponseApiPayload(body, requestIndex) {
  const model = typeof body?.model === "string" ? body.model : "gpt-4o-mini";
  const taskKind = detectTaskKind(body);

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
            text: buildTaskOutput(taskKind),
            annotations: [],
          },
        ],
      },
    ],
    usage: {
      input_tokens: 48,
      output_tokens: 36,
      total_tokens: 84,
    },
  };
}

function buildChatCompletionPayload(body, requestIndex) {
  const model = typeof body?.model === "string" ? body.model : "gpt-4o-mini";
  const taskKind = detectTaskKind(body);

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
          content: buildTaskOutput(taskKind),
          annotations: [],
        },
      },
    ],
    usage: {
      prompt_tokens: 48,
      completion_tokens: 36,
      total_tokens: 84,
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
    state.requestBodies.push(body);
    const requestIndex = state.requestBodies.length;

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

function findArtifactBy(items, predicate, label) {
  const match = items.find(predicate);
  assert(match, `${label} was not found.`);
  return match;
}

function findItemById(items, id, label) {
  const match = items.find((item) => item.id === id);
  assert(match, `${label} was not found.`);
  return match;
}

function assertResolvedArtifactKeys(run, expectedKeys, label) {
  const resolvedArtifacts = Array.isArray(run.resolvedContextArtifacts) ? run.resolvedContextArtifacts : [];
  const resolvedKeys = new Set(
    resolvedArtifacts
      .filter((item) => item && typeof item.artifactKey === "string")
      .map((item) => item.artifactKey),
  );

  for (const key of expectedKeys) {
    assert(resolvedKeys.has(key), `${label} did not include resolved artifact key ${key}.`);
  }
}

function assertAcceptedRevision({
  acceptResponse,
  artifactAfterAccept,
  generatedOutput,
  expectedSummary,
  previousRevisionId,
  previousRevisionCount,
  expectedDraftId,
  expectedRunId,
  label,
}) {
  const currentRevision = artifactAfterAccept.data.currentRevision;
  const revisions = Array.isArray(artifactAfterAccept.data.revisions) ? artifactAfterAccept.data.revisions : [];

  assert(currentRevision, `${label} currentRevision was not updated.`);
  assert(currentRevision.id === acceptResponse.data.id, `${label} accept response revision id did not become currentRevision.`);
  assert(currentRevision.id !== previousRevisionId, `${label} currentRevision id did not change after accept.`);
  assert(currentRevision.content === generatedOutput, `${label} accepted revision content did not match draft output.`);
  assert(currentRevision.summary === expectedSummary, `${label} revision summary did not persist.`);
  assert(revisions.length >= previousRevisionCount + 1, `${label} revision list did not grow after accept.`);
  assert(acceptResponse.data.sourceDraftId === expectedDraftId, `${label} sourceDraftId mismatch.`);
  assert(acceptResponse.data.sourceRunId === expectedRunId, `${label} sourceRunId mismatch.`);
  assert(Array.isArray(acceptResponse.data.syncedArtifacts), `${label} accept response did not include syncedArtifacts.`);
  assert(acceptResponse.data.syncedArtifacts.length === 2, `${label} accept should have synced 2 state artifacts.`);
}

async function main() {
  await ensureProductionBuild();

  const providerState = {
    requestBodies: [],
  };

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

    const email = `smoke-nonchapter-${Date.now()}@example.com`;
    const signup = await fetchJson(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Nonchapter Tester",
        email,
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
          name: "Smoke Nonchapter Project",
          genre: "玄幻",
          platform: "起点",
          status: "active",
        }),
      },
      cookies,
    );
    assertOk(project, "project creation");

    const projectId = project.data.project.id;

    const artifactsInitial = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/artifacts`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(artifactsInitial, "initial artifacts");

    const storyBackgroundArtifact = findArtifactBy(
      artifactsInitial.data.items,
      (item) => item.artifactKey === "story_background",
      "story background artifact",
    );
    const worldBibleArtifact = findArtifactBy(
      artifactsInitial.data.items,
      (item) => item.artifactKey === "world_bible",
      "world bible artifact",
    );
    const protagonistArtifact = findArtifactBy(
      artifactsInitial.data.items,
      (item) => item.artifactKey === "protagonist_card",
      "protagonist card artifact",
    );
    const factionsArtifact = findArtifactBy(
      artifactsInitial.data.items,
      (item) => item.artifactKey === "factions_and_characters",
      "factions artifact",
    );
    const writingRulesArtifact = findArtifactBy(
      artifactsInitial.data.items,
      (item) => item.artifactKey === "writing_rules",
      "writing rules artifact",
    );
    const taskPlanArtifact = findArtifactBy(
      artifactsInitial.data.items,
      (item) => item.artifactKey === "task_plan",
      "task plan artifact",
    );
    const findingsArtifact = findArtifactBy(
      artifactsInitial.data.items,
      (item) => item.artifactKey === "findings",
      "findings artifact",
    );
    const progressArtifact = findArtifactBy(
      artifactsInitial.data.items,
      (item) => item.artifactKey === "progress",
      "progress artifact",
    );
    const currentStateArtifact = findArtifactBy(
      artifactsInitial.data.items,
      (item) => item.artifactKey === "current_state_card",
      "current state artifact",
    );

    assert(storyBackgroundArtifact.currentRevision?.content, "story background bootstrap content was missing.");
    assert(worldBibleArtifact.currentRevision?.content, "world bible bootstrap content was missing.");
    assert(taskPlanArtifact.currentRevision?.content, "task plan bootstrap content was missing.");
    assert(protagonistArtifact.currentRevision?.content, "protagonist card bootstrap content was missing.");
    assert(factionsArtifact.currentRevision?.content, "factions bootstrap content was missing.");
    assert(writingRulesArtifact.currentRevision?.content, "writing rules bootstrap content was missing.");

    const endpoint = await fetchJson(
      `${baseUrl}/api/provider-endpoints`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerType: "openai",
          label: "Mock OpenAI Nonchapter Smoke",
          baseURL: providerBaseUrl,
          authMode: "none",
          extraHeaders: {},
          defaultModel: "gpt-4o-mini",
        }),
      },
      cookies,
    );
    assertOk(endpoint, "endpoint creation");

    const endpointId = endpoint.data.id;
    const providerHealth = await fetchJson(
      `${baseUrl}/api/provider-endpoints/${endpointId}/health`,
      {
        method: "POST",
      },
      cookies,
    );
    assertOk(providerHealth, "provider health probe");
    assert(providerHealth.data.status === "healthy", `provider health was ${providerHealth.data.status}`);

    const findingsBeforeWorkflowAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/artifacts/${findingsArtifact.id}`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(findingsBeforeWorkflowAccept, "findings before workflow accept");

    const workflowGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskType: "workflow_check",
          userInstruction: "请检查当前项目能否继续推进到设定和卷纲阶段，并列出缺失项。",
          endpointId,
          modelId: "gpt-4o-mini",
          selectedArtifactIds: [],
          selectedReferenceIds: [],
          selectedMcpServerIds: [],
          generationOptions: {
            temperature: 0,
            maxTokens: 1000,
          },
        }),
      },
      cookies,
    );
    assertOk(workflowGenerate, "workflow_check generate");
    assert(
      typeof workflowGenerate.data.output === "string" &&
        workflowGenerate.data.output.includes("缺失项：") &&
        workflowGenerate.data.output.includes("下一步建议："),
      "workflow_check output did not match expected contract.",
    );

    const runsAfterWorkflowGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/runs`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(runsAfterWorkflowGenerate, "runs after workflow generate");

    const draftsAfterWorkflowGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/drafts`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(draftsAfterWorkflowGenerate, "drafts after workflow generate");

    const workflowRun = findItemById(
      runsAfterWorkflowGenerate.data.items,
      workflowGenerate.data.runId,
      "workflow_check run",
    );
    const workflowDraft = findItemById(
      draftsAfterWorkflowGenerate.data.items,
      workflowGenerate.data.draftId,
      "workflow_check draft",
    );

    assert(workflowRun.status === "succeeded", `workflow_check run status was ${workflowRun.status}`);
    assert(workflowDraft.status === "ready", `workflow_check draft status was ${workflowDraft.status}`);
    assert(workflowDraft.draftKind === "generated_output", "workflow_check draftKind was not generated_output.");
    assertResolvedArtifactKeys(
      workflowRun,
      ["task_plan", "progress", "current_state_card"],
      "workflow_check run",
    );

    const workflowAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/drafts/${workflowDraft.id}/accept`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artifactId: findingsArtifact.id,
          summary: "Smoke workflow check accept revision",
        }),
      },
      cookies,
    );
    assertOk(workflowAccept, "workflow_check accept");

    const findingsAfterWorkflowAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/artifacts/${findingsArtifact.id}`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(findingsAfterWorkflowAccept, "findings after workflow accept");
    assertAcceptedRevision({
      acceptResponse: workflowAccept,
      artifactAfterAccept: findingsAfterWorkflowAccept,
      generatedOutput: workflowGenerate.data.output,
      expectedSummary: "Smoke workflow check accept revision",
      previousRevisionId: findingsBeforeWorkflowAccept.data.currentRevision?.id ?? null,
      previousRevisionCount: Array.isArray(findingsBeforeWorkflowAccept.data.revisions)
        ? findingsBeforeWorkflowAccept.data.revisions.length
        : 0,
      expectedDraftId: workflowDraft.id,
      expectedRunId: workflowRun.id,
      label: "workflow_check accept",
    });

    const worldBibleBeforeSettingAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/artifacts/${worldBibleArtifact.id}`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(worldBibleBeforeSettingAccept, "world bible before setting accept");

    const settingGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskType: "generate_setting",
          userInstruction: "请补齐港口商战题材的世界规则、地理分区和限制条件。",
          endpointId,
          modelId: "gpt-4o-mini",
          selectedArtifactIds: [],
          selectedReferenceIds: [],
          selectedMcpServerIds: [],
          generationOptions: {
            temperature: 0,
            maxTokens: 1200,
          },
        }),
      },
      cookies,
    );
    assertOk(settingGenerate, "generate_setting generate");
    assert(
      typeof settingGenerate.data.output === "string" &&
        settingGenerate.data.output.includes("## 世界规则") &&
        settingGenerate.data.output.includes(settingMarker),
      "generate_setting output did not match expected contract.",
    );

    const runsAfterSettingGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/runs`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(runsAfterSettingGenerate, "runs after setting generate");

    const draftsAfterSettingGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/drafts`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(draftsAfterSettingGenerate, "drafts after setting generate");

    const settingRun = findItemById(
      runsAfterSettingGenerate.data.items,
      settingGenerate.data.runId,
      "generate_setting run",
    );
    const settingDraft = findItemById(
      draftsAfterSettingGenerate.data.items,
      settingGenerate.data.draftId,
      "generate_setting draft",
    );

    assert(settingRun.status === "succeeded", `generate_setting run status was ${settingRun.status}`);
    assert(settingDraft.status === "ready", `generate_setting draft status was ${settingDraft.status}`);
    assertResolvedArtifactKeys(
      settingRun,
      ["story_background", "world_bible", "protagonist_card", "factions_and_characters", "writing_rules"],
      "generate_setting run",
    );

    const settingAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/drafts/${settingDraft.id}/accept`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artifactId: worldBibleArtifact.id,
          summary: "Smoke setting accept revision",
        }),
      },
      cookies,
    );
    assertOk(settingAccept, "generate_setting accept");

    const worldBibleAfterSettingAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/artifacts/${worldBibleArtifact.id}`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(worldBibleAfterSettingAccept, "world bible after setting accept");
    assertAcceptedRevision({
      acceptResponse: settingAccept,
      artifactAfterAccept: worldBibleAfterSettingAccept,
      generatedOutput: settingGenerate.data.output,
      expectedSummary: "Smoke setting accept revision",
      previousRevisionId: worldBibleBeforeSettingAccept.data.currentRevision?.id ?? null,
      previousRevisionCount: Array.isArray(worldBibleBeforeSettingAccept.data.revisions)
        ? worldBibleBeforeSettingAccept.data.revisions.length
        : 0,
      expectedDraftId: settingDraft.id,
      expectedRunId: settingRun.id,
      label: "generate_setting accept",
    });

    const taskPlanBeforeOutlineAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/artifacts/${taskPlanArtifact.id}`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(taskPlanBeforeOutlineAccept, "task plan before outline accept");

    const projectBeforeOutlineAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(projectBeforeOutlineAccept, "project before outline accept");
    const previousProjectUpdatedAt = Date.parse(projectBeforeOutlineAccept.data.updatedAt);

    const providerRequestStartBeforeOutline = providerState.requestBodies.length;
    const outlineGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskType: "generate_outline",
          userInstruction: "请基于当前设定生成第一卷卷纲、节拍表和关键回收点。",
          endpointId,
          modelId: "gpt-4o-mini",
          selectedArtifactIds: [],
          selectedReferenceIds: [],
          selectedMcpServerIds: [],
          generationOptions: {
            temperature: 0,
            maxTokens: 1200,
          },
        }),
      },
      cookies,
    );
    assertOk(outlineGenerate, "generate_outline generate");
    assert(
      typeof outlineGenerate.data.output === "string" &&
        outlineGenerate.data.output.includes("## 卷纲") &&
        outlineGenerate.data.output.includes("## 节拍表") &&
        outlineGenerate.data.output.includes(settingMarker),
      "generate_outline output did not match expected contract.",
    );

    const outlineRequestBodies = providerState.requestBodies.slice(providerRequestStartBeforeOutline);
    const outlineRequestText = outlineRequestBodies.map((body) => extractBodyText(body)).join("\n");
    assert(
      outlineRequestText.includes(settingMarker),
      "generate_outline request did not include the accepted generate_setting content from world_bible.",
    );

    const runsAfterOutlineGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/runs`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(runsAfterOutlineGenerate, "runs after outline generate");

    const draftsAfterOutlineGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/drafts`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(draftsAfterOutlineGenerate, "drafts after outline generate");

    const outlineRun = findItemById(
      runsAfterOutlineGenerate.data.items,
      outlineGenerate.data.runId,
      "generate_outline run",
    );
    const outlineDraft = findItemById(
      draftsAfterOutlineGenerate.data.items,
      outlineGenerate.data.draftId,
      "generate_outline draft",
    );

    assert(outlineRun.status === "succeeded", `generate_outline run status was ${outlineRun.status}`);
    assert(outlineDraft.status === "ready", `generate_outline draft status was ${outlineDraft.status}`);
    assertResolvedArtifactKeys(
      outlineRun,
      ["story_background", "world_bible", "protagonist_card", "writing_rules", "task_plan"],
      "generate_outline run",
    );

    const outlineAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/drafts/${outlineDraft.id}/accept`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artifactId: taskPlanArtifact.id,
          summary: "Smoke outline accept revision",
        }),
      },
      cookies,
    );
    assertOk(outlineAccept, "generate_outline accept");

    const taskPlanAfterOutlineAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/artifacts/${taskPlanArtifact.id}`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(taskPlanAfterOutlineAccept, "task plan after outline accept");
    assertAcceptedRevision({
      acceptResponse: outlineAccept,
      artifactAfterAccept: taskPlanAfterOutlineAccept,
      generatedOutput: outlineGenerate.data.output,
      expectedSummary: "Smoke outline accept revision",
      previousRevisionId: taskPlanBeforeOutlineAccept.data.currentRevision?.id ?? null,
      previousRevisionCount: Array.isArray(taskPlanBeforeOutlineAccept.data.revisions)
        ? taskPlanBeforeOutlineAccept.data.revisions.length
        : 0,
      expectedDraftId: outlineDraft.id,
      expectedRunId: outlineRun.id,
      label: "generate_outline accept",
    });

    const progressBeforeSyncStateAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/artifacts/${progressArtifact.id}`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(progressBeforeSyncStateAccept, "progress before sync_state accept");

    const currentStateBeforeSyncStateAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/artifacts/${currentStateArtifact.id}`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(currentStateBeforeSyncStateAccept, "current state before sync_state accept");

    const projectBeforeSyncStateAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(projectBeforeSyncStateAccept, "project before sync_state accept");
    const previousSyncStateProjectUpdatedAt = Date.parse(projectBeforeSyncStateAccept.data.updatedAt);

    const providerRequestStartBeforeSyncState = providerState.requestBodies.length;
    const syncStateGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskType: "sync_state",
          userInstruction: "请根据最新 findings、设定和卷纲，同步进度记录与当前状态卡。",
          endpointId,
          modelId: "gpt-4o-mini",
          selectedArtifactIds: [worldBibleArtifact.id, taskPlanArtifact.id],
          selectedReferenceIds: [],
          selectedMcpServerIds: [],
          generationOptions: {
            temperature: 0,
            maxTokens: 1200,
          },
        }),
      },
      cookies,
    );
    assertOk(syncStateGenerate, "sync_state generate");
    assert(
      typeof syncStateGenerate.data.output === "string" &&
        syncStateGenerate.data.output.includes("## 需更新的文件清单") &&
        syncStateGenerate.data.output.includes(syncStateMarker),
      "sync_state output did not match expected contract.",
    );
    assert(
      Array.isArray(syncStateGenerate.data.suggestedPatches) &&
        syncStateGenerate.data.suggestedPatches.includes("progress.md") &&
        syncStateGenerate.data.suggestedPatches.includes("99_当前状态卡.md"),
      "sync_state did not suggest both progress.md and 99_当前状态卡.md.",
    );

    const syncStateRequestBodies = providerState.requestBodies.slice(providerRequestStartBeforeSyncState);
    const syncStateRequestText = syncStateRequestBodies.map((body) => extractBodyText(body)).join("\n");
    assert(
      syncStateRequestText.includes(settingMarker),
      "sync_state request did not include the accepted generate_setting content from world_bible.",
    );
    assert(
      syncStateRequestText.includes(outlineMarker),
      "sync_state request did not include the accepted generate_outline content from task_plan.",
    );

    const runsAfterSyncStateGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/runs`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(runsAfterSyncStateGenerate, "runs after sync_state generate");

    const draftsAfterSyncStateGenerate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/drafts`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(draftsAfterSyncStateGenerate, "drafts after sync_state generate");

    const syncStateRun = findItemById(
      runsAfterSyncStateGenerate.data.items,
      syncStateGenerate.data.runId,
      "sync_state run",
    );
    const syncStateDraft = findItemById(
      draftsAfterSyncStateGenerate.data.items,
      syncStateGenerate.data.draftId,
      "sync_state draft",
    );

    assert(syncStateRun.status === "succeeded", `sync_state run status was ${syncStateRun.status}`);
    assert(syncStateDraft.status === "ready", `sync_state draft status was ${syncStateDraft.status}`);
    assert(syncStateDraft.draftKind === "generated_output", "sync_state draftKind was not generated_output.");
    assertResolvedArtifactKeys(
      syncStateRun,
      ["findings", "progress", "current_state_card", "world_bible", "task_plan"],
      "sync_state run",
    );

    const syncStateAccept = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/drafts/${syncStateDraft.id}/accept`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artifactId: currentStateArtifact.id,
          summary: "Smoke sync state accept revision",
        }),
      },
      cookies,
    );
    assertOk(syncStateAccept, "sync_state accept");

    const progressAfterAllAccepts = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/artifacts/${progressArtifact.id}`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(progressAfterAllAccepts, "progress after all accepts");
    assert(
      progressAfterAllAccepts.data.currentRevision?.id !== progressBeforeSyncStateAccept.data.currentRevision?.id,
      "progress currentRevision id did not change after sync_state auto-sync.",
    );
    assert(
      progressAfterAllAccepts.data.currentRevision?.summary === "Auto sync after accepting 99_当前状态卡.md",
      "progress auto-sync summary did not persist after sync_state accept.",
    );
    assert(
      (Array.isArray(progressAfterAllAccepts.data.revisions) ? progressAfterAllAccepts.data.revisions.length : 0) >=
        (Array.isArray(progressBeforeSyncStateAccept.data.revisions) ? progressBeforeSyncStateAccept.data.revisions.length : 0) + 1,
      "progress revision list did not grow after sync_state auto-sync.",
    );
    assert(
      progressAfterAllAccepts.data.currentRevision?.content?.includes("## 接受日志"),
      "progress artifact did not keep the accept log block.",
    );
    assert(
      progressAfterAllAccepts.data.currentRevision?.content?.includes(
        "findings.md <- workflow_check: Smoke workflow check accept revision",
      ),
      "progress artifact did not record the workflow_check acceptance.",
    );
    assert(
      progressAfterAllAccepts.data.currentRevision?.content?.includes(
        "world_bible.md <- generate_setting: Smoke setting accept revision",
      ),
      "progress artifact did not record the generate_setting acceptance.",
    );
    assert(
      progressAfterAllAccepts.data.currentRevision?.content?.includes(
        "task_plan.md <- generate_outline: Smoke outline accept revision",
      ),
      "progress artifact did not record the generate_outline acceptance.",
    );
    assert(
      progressAfterAllAccepts.data.currentRevision?.content?.includes(
        "99_当前状态卡.md <- sync_state: Smoke sync state accept revision",
      ),
      "progress artifact did not record the sync_state acceptance.",
    );

    const currentStateAfterAllAccepts = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/artifacts/${currentStateArtifact.id}`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(currentStateAfterAllAccepts, "current state after all accepts");
    assert(
      currentStateAfterAllAccepts.data.currentRevision?.id === syncStateAccept.data.id,
      "sync_state accept did not become the current state currentRevision.",
    );
    assert(
      currentStateAfterAllAccepts.data.currentRevision?.id !== currentStateBeforeSyncStateAccept.data.currentRevision?.id,
      "current state currentRevision id did not change after sync_state accept.",
    );
    assert(
      currentStateAfterAllAccepts.data.currentRevision?.content?.includes(syncStateGenerate.data.output.trim()),
      "current state currentRevision did not keep the sync_state generated output.",
    );
    assert(
      currentStateAfterAllAccepts.data.currentRevision?.summary === "Smoke sync state accept revision",
      "current state revision summary did not persist after sync_state accept.",
    );
    assert(
      (Array.isArray(currentStateAfterAllAccepts.data.revisions) ? currentStateAfterAllAccepts.data.revisions.length : 0) >=
        (Array.isArray(currentStateBeforeSyncStateAccept.data.revisions) ? currentStateBeforeSyncStateAccept.data.revisions.length : 0) + 1,
      "current state revision list did not grow after sync_state accept.",
    );
    assert(
      syncStateAccept.data.sourceDraftId === syncStateDraft.id,
      "sync_state accept sourceDraftId mismatch.",
    );
    assert(
      syncStateAccept.data.sourceRunId === syncStateRun.id,
      "sync_state accept sourceRunId mismatch.",
    );
    assert(
      Array.isArray(syncStateAccept.data.syncedArtifacts) && syncStateAccept.data.syncedArtifacts.length === 1,
      "sync_state accept should have produced exactly one synced artifact.",
    );
    assert(
      currentStateAfterAllAccepts.data.currentRevision?.content?.includes("## 自动同步记录"),
      "current state artifact did not keep the auto sync block.",
    );
    assert(
      currentStateAfterAllAccepts.data.currentRevision?.content?.includes("最近回填文件：99_当前状态卡.md"),
      "current state artifact did not point at the last accepted artifact.",
    );
    assert(
      currentStateAfterAllAccepts.data.currentRevision?.content?.includes("来源任务：sync_state"),
      "current state artifact did not record the final task type.",
    );
    assert(
      currentStateAfterAllAccepts.data.currentRevision?.content?.includes("回填摘要：Smoke sync state accept revision"),
      "current state artifact did not record the final accept summary.",
    );

    const projectAfterAllAccepts = await fetchJson(
      `${baseUrl}/api/projects/${projectId}`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(projectAfterAllAccepts, "project after all accepts");
    const nextProjectUpdatedAt = Date.parse(projectAfterAllAccepts.data.updatedAt);
    assert(
      nextProjectUpdatedAt >= previousProjectUpdatedAt &&
        nextProjectUpdatedAt >= previousSyncStateProjectUpdatedAt,
      "project updatedAt did not move forward after sync_state accept.",
    );

    const runsAfterAllAccepts = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/runs`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(runsAfterAllAccepts, "runs after all accepts");
    const workflowRunFinal = findItemById(runsAfterAllAccepts.data.items, workflowRun.id, "workflow_check final run");
    const settingRunFinal = findItemById(runsAfterAllAccepts.data.items, settingRun.id, "generate_setting final run");
    const outlineRunFinal = findItemById(runsAfterAllAccepts.data.items, outlineRun.id, "generate_outline final run");
    const syncStateRunFinal = findItemById(runsAfterAllAccepts.data.items, syncStateRun.id, "sync_state final run");

    for (const run of [workflowRunFinal, settingRunFinal, outlineRunFinal, syncStateRunFinal]) {
      assert(run.status === "succeeded", `expected run ${run.id} to succeed, got ${run.status}`);
    }

    const draftsAfterAllAccepts = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/drafts`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(draftsAfterAllAccepts, "drafts after all accepts");
    const workflowDraftFinal = findItemById(draftsAfterAllAccepts.data.items, workflowDraft.id, "workflow_check final draft");
    const settingDraftFinal = findItemById(draftsAfterAllAccepts.data.items, settingDraft.id, "generate_setting final draft");
    const outlineDraftFinal = findItemById(draftsAfterAllAccepts.data.items, outlineDraft.id, "generate_outline final draft");
    const syncStateDraftFinal = findItemById(draftsAfterAllAccepts.data.items, syncStateDraft.id, "sync_state final draft");

    for (const draft of [workflowDraftFinal, settingDraftFinal, outlineDraftFinal, syncStateDraftFinal]) {
      assert(draft.status === "accepted", `expected draft ${draft.id} to be accepted, got ${draft.status}`);
    }

    assert(providerState.requestBodies.length >= 5, `expected at least 5 provider requests, got ${providerState.requestBodies.length}`);

    console.log(
      JSON.stringify({
        baseUrl,
        providerBaseUrl,
        projectId,
        endpointId,
        workflowRunId: workflowRun.id,
        workflowDraftId: workflowDraft.id,
        settingRunId: settingRun.id,
        settingDraftId: settingDraft.id,
        outlineRunId: outlineRun.id,
        outlineDraftId: outlineDraft.id,
        syncStateRunId: syncStateRun.id,
        syncStateDraftId: syncStateDraft.id,
        findingsArtifactId: findingsArtifact.id,
        worldBibleArtifactId: worldBibleArtifact.id,
        taskPlanArtifactId: taskPlanArtifact.id,
        progressArtifactId: progressArtifact.id,
        finalProjectUpdatedAt: projectAfterAllAccepts.data.updatedAt,
        providerRequestCount: providerState.requestBodies.length,
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
