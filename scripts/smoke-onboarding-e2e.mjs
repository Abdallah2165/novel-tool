import http from "node:http";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import process from "node:process";

const nextPort = Number(process.env.NEXT_SMOKE_PORT || 3113);
const providerPort = Number(process.env.MOCK_PROVIDER_PORT || 3123);
const loopbackAlias = process.env.SMOKE_LOOPBACK_HOST || "localhost.localstack.cloud";

const baseUrl = `http://localhost:${nextPort}`;
const providerBaseUrl = `http://${loopbackAlias}:${providerPort}/v1`;
const nextBin = "node_modules/next/dist/bin/next";

const promptOverlayMarker = "强调交易收益链和港岛势力秩序";
const skillOverlayMarker = "Reviewer 偏重";
const onboardingTitle = "港综资本局";
const blankProjectTitle = "港口旧账局";
const blankAuthorNotes = "已有材料以码头账本和旧商会恩怨为主线，请先整理再补问。";
const blankMarkdownMarker = "旧账簿显示，第七码头的夜班仓位会优先让给能当场结清税票的人。";
const blankHtmlMarker = "首帖摘要：旧商会会借秋汛船期压低新人的夜班装卸顺位。";
const blankHtmlOneboxMarker = "Onebox 摘要：夜航货船必须先核验税票，再按潮位钟点入港。";
const blankScriptNoiseMarker = "不要进入初始化整理正文";
const blankConflictAnswer = "主角要借夜班仓位调度撬开旧账局，但旧商会和巡捕房都盯着他的账本缺口。";
const blankWorldRulesAnswer = "越过税票和夜航底线就会被港务、巡捕和黑平码头一起清场，不能硬闯。";
const blankFactionsAnswer = "旧商会、码头帮、巡捕内线和船运金主四方互相制衡，谁都想先吃掉主角手里的旧账。";
const blankStyleAnswer = "章节先打收益点，再补规则解释；港口税票与夜航制度只做轻量考据。";

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
  const bodyText = extractBodyText(body);
  const matches = [
    {
      taskKind: "ingest_sources",
      index: findFirstMarkerIndex(bodyText, [
        "ingest_sources",
        "初始化整理摘要",
        "待补充问题",
        "findings.md 建议回填",
      ]),
    },
    {
      taskKind: "workflow_check",
      index: findFirstMarkerIndex(bodyText, [
        "workflow_check",
        "工作流检查结果",
        "请检查 onboarding 后的项目骨架是否足够继续推进设定和卷纲",
        "请检查 blank onboarding 后的项目骨架是否足够继续推进设定和卷纲",
      ]),
    },
  ]
    .filter((item) => Number.isFinite(item.index))
    .sort((left, right) => left.index - right.index);

  return matches[0]?.taskKind ?? "workflow_check";
}

function buildTaskOutput(taskKind, body) {
  const bodyText = extractBodyText(body);

  if (bodyText.includes("Reply with exactly OK")) {
    return "OK";
  }

  if (taskKind === "ingest_sources") {
    return [
      "# 初始化整理摘要",
      "",
      "## 已识别信息",
      "### 故事前提与题材定位",
      `- ${blankMarkdownMarker}`,
      `- ${blankHtmlMarker}`,
      "### 角色/势力/世界规则",
      `- ${blankHtmlOneboxMarker}`,
      "- 当前材料已经写明旧账、夜班仓位与秋汛船期会直接影响主角能否站稳第一步。",
      "",
      "## 待补充问题",
      "- [核心冲突] 当前材料已经给出旧账和夜班仓位线，但还缺“主角眼下具体要赢什么、谁会先卡死他”。",
      "- [世界规则] 当前材料已经写到税票、潮位与入港顺序，但还缺“哪些规则碰了就会被联手清场”。",
      "- [势力关系] 当前材料已经出现旧商会和码头线，但还缺“谁和主角合作、谁盯着主角手里的旧账”。",
      "- [文风与考据] 当前材料已有港口制度细节，但还缺“平台向节奏要求，以及考据只做到什么边界”。",
      "",
      "## findings.md 建议回填",
      `- ${blankMarkdownMarker}`,
      `- ${blankHtmlMarker}`,
      `- ${blankHtmlOneboxMarker}`,
    ].join("\n");
  }

  return [
    "# 工作流检查结果",
    "",
    "## 当前已有项",
    "- onboarding 生成的标准 artifact 与项目级 overlay 已可读。",
    "",
    "## 风险项",
    "- 建议先执行 generate_setting / generate_outline，再进入正文阶段。",
    "",
    "## 下一步建议",
    "- 按主链继续推进。",
  ].join("\n");
}

function buildResponseApiPayload(body, requestIndex) {
  const model = typeof body?.model === "string" ? body.model : "gpt-4o-mini";
  const output = buildTaskOutput(detectTaskKind(body), body);

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
      input_tokens: 48,
      output_tokens: 36,
      total_tokens: 84,
    },
  };
}

function buildChatCompletionPayload(body, requestIndex) {
  const model = typeof body?.model === "string" ? body.model : "gpt-4o-mini";
  const output = buildTaskOutput(detectTaskKind(body), body);

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

    const email = `smoke-onboarding-${Date.now()}@example.com`;
    const signup = await fetchJson(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Onboarding Tester",
        email,
        password: "Passw0rd123!",
      }),
    });
    assertOk(signup, "signup");
    assert(signup.cookies.length > 0, "signup succeeded but no session cookie was returned.");

    const cookies = signup.cookies;

    const sessionCreate = await fetchJson(
      `${baseUrl}/api/projects/bootstrap/session`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
      cookies,
    );
    assertOk(sessionCreate, "create onboarding session");
    const sessionId = sessionCreate.data.session.id;

    const answers = [
      "暂定名《港综资本局》。题材是港综商战，平台走番茄，目标做长篇。",
      "主角要在港岛金融圈站稳脚跟，但黑白两道都盯着他的底牌和现金流。",
      "异能必须付出寿命代价，不能公开展示；触碰底线会被官方与地下势力同时追杀。",
      "财阀、社团、警方内线和师门是四条核心关系线，彼此互相利用也互相制衡。",
      `章节要短钩子强，${promptOverlayMarker}，禁写降智误会和无收益抒情。`,
      "金融法规、港岛地理和警务体系需要考据。",
    ];

    for (const answer of answers) {
      const response = await fetchJson(
        `${baseUrl}/api/projects/bootstrap/session/${sessionId}/answer`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "answer",
            answer,
          }),
        },
        cookies,
      );
      assertOk(response, "answer onboarding question");
    }

    const finalize = await fetchJson(
      `${baseUrl}/api/projects/bootstrap/session/${sessionId}/finalize`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: onboardingTitle,
          genre: "港综商战",
          platform: "番茄",
        }),
      },
      cookies,
    );
    assertOk(finalize, "finalize onboarding project");

    const projectId = finalize.data.project.id;
    const artifacts = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/artifacts`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(artifacts, "list project artifacts");

    const storyBackgroundArtifact = findArtifactBy(
      artifacts.data.items,
      (item) => item.artifactKey === "story_background",
      "story background artifact",
    );
    const promptPackArtifact = findArtifactBy(
      artifacts.data.items,
      (item) => item.artifactKey === "project_prompt_pack",
      "project prompt pack artifact",
    );
    const skillPackArtifact = findArtifactBy(
      artifacts.data.items,
      (item) => item.artifactKey === "project_skill_pack",
      "project skill pack artifact",
    );
    const onboardingBriefArtifact = findArtifactBy(
      artifacts.data.items,
      (item) => item.artifactKey === "onboarding_brief",
      "onboarding brief artifact",
    );

    assert(
      storyBackgroundArtifact.currentRevision?.content?.includes(onboardingTitle),
      "story_background did not absorb onboarding data.",
    );
    assert(
      promptPackArtifact.currentRevision?.content?.includes(promptOverlayMarker),
      "project_prompt_pack content was not generated from onboarding answers.",
    );
    assert(
      skillPackArtifact.currentRevision?.content?.includes(skillOverlayMarker),
      "project_skill_pack content was not generated from onboarding answers.",
    );
    assert(
      onboardingBriefArtifact.currentRevision?.content?.includes("问答摘要"),
      "onboarding_brief content was missing the summary section.",
    );

    const endpoint = await fetchJson(
      `${baseUrl}/api/provider-endpoints`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerType: "openai",
          label: "Mock OpenAI Onboarding Smoke",
          baseURL: providerBaseUrl,
          authMode: "none",
          extraHeaders: {},
          defaultModel: "gpt-4o-mini",
        }),
      },
      cookies,
    );
    assertOk(endpoint, "endpoint creation");

    const generate = await fetchJson(
      `${baseUrl}/api/projects/${projectId}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskType: "workflow_check",
          userInstruction: "请检查 onboarding 后的项目骨架是否足够继续推进设定和卷纲。",
          endpointId: endpoint.data.id,
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
    assertOk(generate, "workflow_check generate");
    assert(
      Array.isArray(generate.data.resolvedSkills) && generate.data.resolvedSkills.includes("project_skill_pack"),
      "resolvedSkills did not include project_skill_pack overlay.",
    );
    assert(
      Array.isArray(generate.data.resolvedArtifacts) &&
        generate.data.resolvedArtifacts.some((item) => item.artifactKey === "project_prompt_pack") &&
        generate.data.resolvedArtifacts.some((item) => item.artifactKey === "project_skill_pack"),
      "resolvedArtifacts did not include project overlay artifacts.",
    );

    const providerRequestText = providerState.requestBodies.map((body) => extractBodyText(body)).join("\n");
    assert(
      providerRequestText.includes("项目专属 Prompt Overlay") && providerRequestText.includes(promptOverlayMarker),
      "provider request did not include the project_prompt_pack overlay.",
    );
    assert(
      providerRequestText.includes("项目专属 Skill Overlay") && providerRequestText.includes(skillOverlayMarker),
      "provider request did not include the project_skill_pack overlay.",
    );

    const blankProjectCreate = await fetchJson(
      `${baseUrl}/api/projects`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: blankProjectTitle,
          genre: "港口商战",
          platform: "番茄",
        }),
      },
      cookies,
    );
    assertOk(blankProjectCreate, "create blank onboarding project");
    const blankProjectId = blankProjectCreate.data.project.id;

    const markdownForm = new FormData();
    markdownForm.set(
      "file",
      new File(
        [
          [
            "# 旧账簿摘录",
            "",
            blankMarkdownMarker,
            "账房规定：遇到秋汛船期，先看税票，再看谁能当场补齐旧账。",
          ].join("\n"),
        ],
        "old-ledger.md",
        { type: "text/markdown" },
      ),
    );
    markdownForm.set("tags", "账本, 夜班");

    const markdownReference = await fetchJson(
      `${baseUrl}/api/projects/${blankProjectId}/references`,
      {
        method: "POST",
        body: markdownForm,
      },
      cookies,
    );
    assertOk(markdownReference, "blank onboarding markdown reference upload");
    assert(
      markdownReference.data.normalizedText?.includes(blankMarkdownMarker),
      "blank markdown reference did not keep the readable text.",
    );

    const htmlForm = new FormData();
    htmlForm.set(
      "file",
      new File(
        [
          [
            "<!doctype html>",
            `<html><head><title>旧商会讨论串</title><script>window.__noise='${blankScriptNoiseMarker}'</script></head>`,
            "<body><header>论坛导航</header><article>",
            "<h1>旧商会讨论串</h1>",
            `<p>${blankHtmlMarker}</p>`,
            '<div class="onebox"><a href="https://example.com/night-port">Onebox 标题：夜港调度旧闻</a>',
            `<p>${blankHtmlOneboxMarker}</p></div>`,
            "</article><footer>论坛页脚</footer></body></html>",
          ].join(""),
        ],
        "guild-thread.html",
        { type: "text/html" },
      ),
    );
    htmlForm.set("tags", "论坛, HTML");
    htmlForm.set("sourceUrl", "https://example.com/guild-thread");

    const htmlReference = await fetchJson(
      `${baseUrl}/api/projects/${blankProjectId}/references`,
      {
        method: "POST",
        body: htmlForm,
      },
      cookies,
    );
    assertOk(htmlReference, "blank onboarding html reference upload");
    assert(
      typeof htmlReference.data.normalizedText === "string" &&
        htmlReference.data.normalizedText.includes(blankHtmlMarker) &&
        htmlReference.data.normalizedText.includes(blankHtmlOneboxMarker),
      "blank html reference did not keep the visible readable text.",
    );
    assert(
      !htmlReference.data.normalizedText.includes(blankScriptNoiseMarker),
      "blank html reference still contained stripped script noise.",
    );

    const providerRequestStartBeforeBlankDigest = providerState.requestBodies.length;
    const blankDigestGenerate = await fetchJson(
      `${baseUrl}/api/projects/${blankProjectId}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskType: "ingest_sources",
          userInstruction: "请先把作者材料整理成初始化摘要，再标出标准 artifact 还缺的关键信息。",
          endpointId: endpoint.data.id,
          modelId: "gpt-4o-mini",
          selectedArtifactIds: [],
          selectedReferenceIds: [markdownReference.data.id, htmlReference.data.id],
          selectedMcpServerIds: [],
          generationOptions: {
            temperature: 0,
            maxTokens: 1200,
          },
        }),
      },
      cookies,
    );
    assertOk(blankDigestGenerate, "blank onboarding ingest_sources generate");
    assert(
      typeof blankDigestGenerate.data.output === "string" &&
        blankDigestGenerate.data.output.includes("## 已识别信息") &&
        blankDigestGenerate.data.output.includes("## 待补充问题") &&
        blankDigestGenerate.data.output.includes("## findings.md 建议回填"),
      "blank onboarding digest output did not match the expected contract.",
    );
    assert(
      Array.isArray(blankDigestGenerate.data.suggestedPatches) &&
        blankDigestGenerate.data.suggestedPatches.includes("findings.md"),
      "blank onboarding digest did not suggest findings.md as the accept target.",
    );
    assert(
      Array.isArray(blankDigestGenerate.data.resolvedArtifacts) && blankDigestGenerate.data.resolvedArtifacts.length === 0,
      "blank onboarding digest should not auto-resolve project artifacts when only references are selected.",
    );

    const blankDigestRequestText = providerState.requestBodies
      .slice(providerRequestStartBeforeBlankDigest)
      .map((body) => extractBodyText(body))
      .join("\n");
    assert(
      blankDigestRequestText.includes(blankMarkdownMarker),
      "blank onboarding provider request did not include the uploaded markdown material.",
    );
    assert(
      blankDigestRequestText.includes(blankHtmlMarker) && blankDigestRequestText.includes(blankHtmlOneboxMarker),
      "blank onboarding provider request did not include the extracted html readable text.",
    );
    assert(
      !blankDigestRequestText.includes(blankScriptNoiseMarker),
      "blank onboarding provider request still contained stripped html shell/script noise.",
    );

    const blankRuns = await fetchJson(
      `${baseUrl}/api/projects/${blankProjectId}/runs`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(blankRuns, "list blank onboarding runs");
    const blankRun = findItemById(blankRuns.data.items, blankDigestGenerate.data.runId, "blank onboarding digest run");
    assert(blankRun.status === "succeeded", `blank onboarding digest run status was ${blankRun.status}`);
    assert(
      Array.isArray(blankRun.selectedReferenceIds) &&
        blankRun.selectedReferenceIds.includes(markdownReference.data.id) &&
        blankRun.selectedReferenceIds.includes(htmlReference.data.id),
      "blank onboarding digest run did not persist the selected reference ids.",
    );
    assert(
      Array.isArray(blankRun.selectedArtifactIds) && blankRun.selectedArtifactIds.length === 0,
      "blank onboarding digest run should keep selectedArtifactIds empty.",
    );
    assert(
      Array.isArray(blankRun.resolvedContextArtifacts) && blankRun.resolvedContextArtifacts.length === 0,
      "blank onboarding digest run should keep resolvedContextArtifacts empty.",
    );

    const blankDrafts = await fetchJson(
      `${baseUrl}/api/projects/${blankProjectId}/drafts`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(blankDrafts, "list blank onboarding drafts");
    const blankDigestDraft = findItemById(
      blankDrafts.data.items,
      blankDigestGenerate.data.draftId,
      "blank onboarding digest draft",
    );
    assert(blankDigestDraft.status === "ready", `blank onboarding digest draft status was ${blankDigestDraft.status}`);

    const blankFinalize = await fetchJson(
      `${baseUrl}/api/projects/${blankProjectId}/blank-onboarding/finalize`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          digestDraftId: blankDigestDraft.id,
          digestOutput: blankDigestGenerate.data.output,
          authorNotes: blankAuthorNotes,
          importedReferenceIds: [markdownReference.data.id, htmlReference.data.id],
          followUpAnswers: [
            {
              questionKey: "core_conflict",
              answer: blankConflictAnswer,
            },
            {
              questionKey: "world_rules",
              answer: blankWorldRulesAnswer,
            },
            {
              questionKey: "factions",
              answer: blankFactionsAnswer,
            },
            {
              questionKey: "style_research",
              answer: blankStyleAnswer,
            },
          ],
        }),
      },
      cookies,
    );
    assertOk(blankFinalize, "finalize blank onboarding project");
    assert(
      blankFinalize.data.followUpAnswerCount === 4,
      `expected 4 blank onboarding follow-up answers, got ${blankFinalize.data.followUpAnswerCount}`,
    );
    assert(
      Array.isArray(blankFinalize.data.appliedArtifactKeys) &&
        blankFinalize.data.appliedArtifactKeys.includes("project_prompt_pack") &&
        blankFinalize.data.appliedArtifactKeys.includes("project_skill_pack") &&
        blankFinalize.data.appliedArtifactKeys.includes("onboarding_brief"),
      "blank onboarding finalize did not apply the overlay artifacts.",
    );

    const blankArtifacts = await fetchJson(
      `${baseUrl}/api/projects/${blankProjectId}/artifacts`,
      {
        method: "GET",
      },
      cookies,
    );
    assertOk(blankArtifacts, "list blank onboarding artifacts");

    const blankStoryBackgroundArtifact = findArtifactBy(
      blankArtifacts.data.items,
      (item) => item.artifactKey === "story_background",
      "blank story background artifact",
    );
    const blankFindingsArtifact = findArtifactBy(
      blankArtifacts.data.items,
      (item) => item.artifactKey === "findings",
      "blank findings artifact",
    );
    const blankPromptPackArtifact = findArtifactBy(
      blankArtifacts.data.items,
      (item) => item.artifactKey === "project_prompt_pack",
      "blank project prompt pack artifact",
    );
    const blankSkillPackArtifact = findArtifactBy(
      blankArtifacts.data.items,
      (item) => item.artifactKey === "project_skill_pack",
      "blank project skill pack artifact",
    );
    const blankOnboardingBriefArtifact = findArtifactBy(
      blankArtifacts.data.items,
      (item) => item.artifactKey === "onboarding_brief",
      "blank onboarding brief artifact",
    );

    assert(
      blankStoryBackgroundArtifact.currentRevision?.content?.includes(blankProjectTitle) &&
        blankStoryBackgroundArtifact.currentRevision?.content?.includes(blankConflictAnswer),
      "blank story_background did not absorb the finalized conflict summary.",
    );
    assert(
      blankFindingsArtifact.currentRevision?.content?.includes("old-ledger.md") &&
        blankFindingsArtifact.currentRevision?.content?.includes("guild-thread.html") &&
        blankFindingsArtifact.currentRevision?.content?.includes(blankMarkdownMarker) &&
        blankFindingsArtifact.currentRevision?.content?.includes(blankHtmlMarker),
      "blank findings artifact did not keep the imported materials and digest markers.",
    );
    assert(
      blankPromptPackArtifact.currentRevision?.content?.includes(blankStyleAnswer),
      "blank project_prompt_pack content was not generated from blank onboarding answers.",
    );
    assert(
      blankSkillPackArtifact.currentRevision?.content?.includes(blankConflictAnswer),
      "blank project_skill_pack content was not generated from blank onboarding answers.",
    );
    assert(
      blankOnboardingBriefArtifact.currentRevision?.content?.includes(blankFactionsAnswer),
      "blank onboarding_brief content was missing the follow-up summary.",
    );

    const providerRequestStartBeforeBlankWorkflow = providerState.requestBodies.length;
    const blankWorkflowCheck = await fetchJson(
      `${baseUrl}/api/projects/${blankProjectId}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskType: "workflow_check",
          userInstruction: "请检查 blank onboarding 后的项目骨架是否足够继续推进设定和卷纲。",
          endpointId: endpoint.data.id,
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
    assertOk(blankWorkflowCheck, "blank workflow_check generate");
    assert(
      Array.isArray(blankWorkflowCheck.data.resolvedSkills) &&
        blankWorkflowCheck.data.resolvedSkills.includes("project_skill_pack"),
      "blank workflow_check resolvedSkills did not include project_skill_pack overlay.",
    );
    assert(
      Array.isArray(blankWorkflowCheck.data.resolvedArtifacts) &&
        blankWorkflowCheck.data.resolvedArtifacts.some((item) => item.artifactKey === "project_prompt_pack") &&
        blankWorkflowCheck.data.resolvedArtifacts.some((item) => item.artifactKey === "project_skill_pack"),
      "blank workflow_check resolvedArtifacts did not include project overlay artifacts.",
    );

    const blankWorkflowRequestText = providerState.requestBodies
      .slice(providerRequestStartBeforeBlankWorkflow)
      .map((body) => extractBodyText(body))
      .join("\n");
    assert(
      blankWorkflowRequestText.includes("项目专属 Prompt Overlay") && blankWorkflowRequestText.includes(blankStyleAnswer),
      "blank workflow_check provider request did not include the blank prompt overlay.",
    );
    assert(
      blankWorkflowRequestText.includes("项目专属 Skill Overlay") && blankWorkflowRequestText.includes(blankConflictAnswer),
      "blank workflow_check provider request did not include the blank skill overlay.",
    );

    console.log(
      JSON.stringify({
        baseUrl,
        providerBaseUrl,
        sessionId,
        guidedProjectId: projectId,
        blankProjectId,
        endpointId: endpoint.data.id,
        guidedDraftId: generate.data.draftId,
        guidedRunId: generate.data.runId,
        blankDigestDraftId: blankDigestGenerate.data.draftId,
        blankDigestRunId: blankDigestGenerate.data.runId,
        blankWorkflowDraftId: blankWorkflowCheck.data.draftId,
        blankWorkflowRunId: blankWorkflowCheck.data.runId,
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
