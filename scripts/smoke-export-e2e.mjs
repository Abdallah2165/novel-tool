import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const port = Number(process.env.NEXT_SMOKE_PORT || 3114);
const baseUrl = `http://localhost:${port}`;
const nextBin = "node_modules/next/dist/bin/next";

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
    headers: response.headers,
  };
}

async function fetchText(url, options = {}, cookies = []) {
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

  return {
    status: response.status,
    body: await response.text(),
    headers: response.headers,
  };
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

function resolveLocalObjectPath(storageKey) {
  return path.join(process.cwd(), ".data", "object-store", ...storageKey.split("/"));
}

async function main() {
  await ensureProductionBuild();

  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
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

    const email = `smoke-export-${Date.now()}@example.com`;
    const signup = await fetchJson(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Export Tester",
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
          name: "Smoke Export Project",
          genre: "历史",
          platform: "起点",
          status: "active",
        }),
      },
      cookies,
    );
    assertOk(project, "project creation");

    const projectId = project.data.project.id;

    const firstExport = await fetchJson(
      `${baseUrl}/projects/${projectId}/exports`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bundleKey: "setting-outline",
        }),
      },
      cookies,
    );
    assertOk(firstExport, "setting-outline export");
    assert(firstExport.data.record.fileCount > 0, "setting-outline export returned no files.");
    assert(
      firstExport.data.record.storageKey.includes(`/exports/${firstExport.data.record.id}/`),
      "setting-outline storage key did not include the export id.",
    );

    if (firstExport.data.record.objectStoreMode === "local") {
      await access(resolveLocalObjectPath(firstExport.data.record.storageKey));
    }

    const secondExport = await fetchJson(
      `${baseUrl}/projects/${projectId}/exports`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bundleKey: "state-summary",
        }),
      },
      cookies,
    );
    assertOk(secondExport, "state-summary export");
    assert(secondExport.data.record.fileCount > 0, "state-summary export returned no files.");

    const projectDetail = await fetchJson(`${baseUrl}/api/projects/${projectId}`, { method: "GET" }, cookies);
    assertOk(projectDetail, "project detail");

    const exportRecords = projectDetail.data.preference?.exportRecords ?? [];
    assert(exportRecords.length >= 2, "project export history did not persist both records.");
    assert(
      exportRecords[0]?.id === secondExport.data.record.id && exportRecords[1]?.id === firstExport.data.record.id,
      "project export history order was not newest-first.",
    );

    const download = await fetchText(
      `${baseUrl}/projects/${projectId}/exports/${firstExport.data.record.id}`,
      {
        method: "GET",
      },
      cookies,
    );
    assert(download.status === 200, `historical export download failed: ${download.status}`);
    assert(download.headers.get("content-disposition")?.includes("attachment;"), "download was not an attachment.");
    assert(download.body.includes("# Smoke Export Project 设定与卷纲快照"), "download body missed export title.");
    assert(!download.body.includes("## Knowledge Provenance Snapshot"), "download body still contained provenance appendix.");

    console.log(
      JSON.stringify({
        baseUrl,
        projectId,
        firstExportId: firstExport.data.record.id,
        secondExportId: secondExport.data.record.id,
        firstExportMode: firstExport.data.record.objectStoreMode,
        secondExportMode: secondExport.data.record.objectStoreMode,
        exportHistoryCount: exportRecords.length,
        downloadedFileName: firstExport.data.record.fileName,
      }),
    );
  } finally {
    child.kill("SIGTERM");
    await sleep(1000);

    if (!child.killed) {
      child.kill("SIGKILL");
    }

    if (stderr.trim()) {
      process.stderr.write(stderr);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
