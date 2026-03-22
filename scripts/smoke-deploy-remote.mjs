import { spawn } from "node:child_process";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const deployScriptSource = path.resolve("scripts/deploy-remote.sh");
const windowsDockerImage =
  process.env.DEPLOY_REMOTE_SMOKE_DOCKER_IMAGE || "debian:bookworm-slim";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(haystack, needle, label) {
  assert(haystack.includes(needle), `${label} did not include expected text: ${needle}`);
}

async function assertFileExists(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${label} was not found: ${filePath}`);
  }
}

async function runCommand(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      resolve({
        code: code ?? 1,
        signal: signal ?? null,
        stdout,
        stderr,
      });
    });
  });
}

function buildFakeGitScript() {
  return [
    "#!/bin/sh",
    "set -eu",
    'repo_dir=${FAKE_REPO_DIR:?}',
    'state_dir="$repo_dir/.fake-state"',
    'log_file="$state_dir/git.log"',
    'current_head_file="$state_dir/current-head"',
    'origin_head_file="$state_dir/origin-main-head"',
    'fetch_head_file="$state_dir/fetch-head"',
    'local_branch_file="$state_dir/local-main-exists"',
    'printf "git %s\\n" "$*" >> "$log_file"',
    'command_name=${1:-}',
    'if [ "$#" -gt 0 ]; then',
    "  shift",
    "fi",
    'case "$command_name" in',
    "  rev-parse)",
    '    if [ "${1:-}" = "HEAD" ]; then',
    '      cat "$current_head_file"',
    "      exit 0",
    "    fi",
    "    ;;",
    "  fetch)",
    '    if [ "${1:-}" = "origin" ] && [ -f "$origin_head_file" ]; then',
    '      cp "$origin_head_file" "$fetch_head_file"',
    "    fi",
    "    exit 0",
    "    ;;",
    "  show-ref)",
    '    ref="${3:-}"',
    '    case "$ref" in',
    "      refs/remotes/origin/*)",
    "        exit 0",
    "        ;;",
    "      refs/heads/*)",
    '        if [ -f "$local_branch_file" ]; then',
    "          exit 0",
    "        fi",
    "        exit 1",
    "        ;;",
    "    esac",
    "    exit 1",
    "    ;;",
    "  checkout)",
    '    if [ "${1:-}" = "--track" ]; then',
    '      touch "$local_branch_file"',
    '      cp "$origin_head_file" "$current_head_file"',
    "      exit 0",
    "    fi",
    '    if [ "${1:-}" = "--detach" ]; then',
    '      target="${2:-}"',
    '      if [ "$target" = "FETCH_HEAD" ]; then',
    '        cat "$fetch_head_file" > "$current_head_file"',
    "      else",
    '        printf "%s\\n" "$target" > "$current_head_file"',
    "      fi",
    "      exit 0",
    "    fi",
    '    touch "$local_branch_file"',
    "    exit 0",
    "    ;;",
    "  pull)",
    '    cp "$origin_head_file" "$current_head_file"',
    "    exit 0",
    "    ;;",
    "esac",
    'echo "unsupported fake git command: $command_name $*" >&2',
    "exit 1",
    "",
  ].join("\n");
}

function buildFakeDockerScript() {
  return [
    "#!/bin/sh",
    "set -eu",
    'repo_dir=${FAKE_REPO_DIR:?}',
    'state_dir="$repo_dir/.fake-state"',
    'log_file="$state_dir/docker.log"',
    'current_image_file="$state_dir/current-image"',
    'printf "docker APP_IMAGE=%s :: %s\\n" "${APP_IMAGE:-}" "$*" >> "$log_file"',
    'command_name=${1:-}',
    'if [ "$#" -gt 0 ]; then',
    "  shift",
    "fi",
    'if [ "$command_name" = "login" ]; then',
    "  cat >/dev/null",
    "  exit 0",
    "fi",
    'if [ "$command_name" != "compose" ]; then',
    '  echo "unsupported fake docker command: $command_name" >&2',
    "  exit 1",
    "fi",
    'if [ "${1:-}" = "--env-file" ]; then',
    "  shift 2",
    "fi",
    'subcommand=${1:-}',
    'if [ "$#" -gt 0 ]; then',
    "  shift",
    "fi",
    'case "$subcommand" in',
    "  port)",
    '    printf "0.0.0.0:3000\\n"',
    "    exit 0",
    "    ;;",
    "  pull)",
    '    if [ -n "${APP_IMAGE:-}" ]; then',
    '      printf "%s\\n" "$APP_IMAGE" > "$current_image_file"',
    "    fi",
    "    exit 0",
    "    ;;",
    "  up)",
    '    if [ -n "${APP_IMAGE:-}" ]; then',
    '      printf "%s\\n" "$APP_IMAGE" > "$current_image_file"',
    "    fi",
    "    exit 0",
    "    ;;",
    "  ps)",
    '    current_image=$(cat "$current_image_file" 2>/dev/null || printf "unknown-image")',
    '    current_commit=$(cat "$state_dir/current-head" 2>/dev/null || printf "unknown-commit")',
    '    printf "NAME IMAGE STATUS COMMIT\\n"',
    '    printf "novel-tools-app %s running %s\\n" "$current_image" "$current_commit"',
    "    exit 0",
    "    ;;",
    "  logs)",
    '    current_image=$(cat "$current_image_file" 2>/dev/null || printf "unknown-image")',
    '    printf "app logs for %s\\n" "$current_image"',
    "    exit 0",
    "    ;;",
    "esac",
    'echo "unsupported fake docker compose subcommand: $subcommand" >&2',
    "exit 1",
    "",
  ].join("\n");
}

function buildFakeCurlScript() {
  return [
    "#!/bin/sh",
    "set -eu",
    'repo_dir=${FAKE_REPO_DIR:?}',
    'state_dir="$repo_dir/.fake-state"',
    'log_file="$state_dir/curl.log"',
    'url=""',
    'for arg in "$@"; do',
    '  url="$arg"',
    "done",
    'current_image=$(cat "$state_dir/current-image" 2>/dev/null || sed -n \'s/^APP_IMAGE=//p\' "$repo_dir/.env.docker" | tail -n 1)',
    'printf "curl current_image=%s url=%s\\n" "$current_image" "$url" >> "$log_file"',
    'case "$url" in',
    "  */login)",
    '    printf "<html><body>login ok</body></html>\\n"',
    "    exit 0",
    "    ;;",
    "  */api/health)",
    '    case "$current_image" in',
    "      *bad*)",
    '        printf \'{"status":"starting","database":"starting"}\\n\'',
    "        exit 0",
    "        ;;",
    "      *)",
    '        printf \'{"status":"ok","database":"ok"}\\n\'',
    "        exit 0",
    "        ;;",
    "    esac",
    "    ;;",
    "esac",
    'echo "fake curl received an unexpected url: $url" >&2',
    "exit 22",
    "",
  ].join("\n");
}

async function writeExecutableScript(filePath, contents) {
  await writeFile(filePath, contents, "utf8");
  await chmod(filePath, 0o755);
}

async function createScenarioRoot(scenario) {
  const prefix = path.join(process.cwd(), `.tmp-smoke-deploy-remote-${scenario}-`);
  return await mkdtemp(prefix);
}

async function prepareScenarioEnvironment(tempRoot, scenarioConfig) {
  const appDir = path.join(tempRoot, "app");
  const stateDir = path.join(appDir, ".fake-state");
  const fakeBinDir = path.join(tempRoot, "fakebin");
  const deployScriptPath = path.join(tempRoot, "deploy-remote.sh");

  await mkdir(appDir, { recursive: true });
  await mkdir(stateDir, { recursive: true });
  await mkdir(fakeBinDir, { recursive: true });

  await copyFile(deployScriptSource, deployScriptPath);
  await chmod(deployScriptPath, 0o755);

  await writeFile(
    path.join(appDir, ".env.docker"),
    `APP_IMAGE=${scenarioConfig.previousImage}\n`,
    "utf8",
  );
  await writeFile(path.join(stateDir, "current-head"), `${scenarioConfig.previousCommit}\n`, "utf8");
  await writeFile(path.join(stateDir, "origin-main-head"), `${scenarioConfig.deployedCommit}\n`, "utf8");
  await writeFile(path.join(stateDir, "current-image"), `${scenarioConfig.previousImage}\n`, "utf8");
  await writeFile(path.join(stateDir, "local-main-exists"), "1\n", "utf8");

  await writeExecutableScript(path.join(fakeBinDir, "git"), buildFakeGitScript());
  await writeExecutableScript(path.join(fakeBinDir, "docker"), buildFakeDockerScript());
  await writeExecutableScript(path.join(fakeBinDir, "curl"), buildFakeCurlScript());

}

function toDockerMountPath(targetPath) {
  return path.resolve(targetPath).replace(/\\/g, "/");
}

async function runDeployScript(tempRoot, scenarioConfig) {
  const envBase = {
    APP_IMAGE: scenarioConfig.requestedImage,
    DEPLOY_APP_DIR: path.join(tempRoot, "app"),
    DEPLOY_ENV_FILE: ".env.docker",
    DEPLOY_REF: "main",
    DEPLOY_LOG_TAIL_LINES: "20",
    DEPLOY_REPORT_ROOT: ".deploy-reports",
    DEPLOY_SMOKE_MAX_ATTEMPTS: "2",
    DEPLOY_SMOKE_WAIT_SECONDS: "0",
    FAKE_REPO_DIR: path.join(tempRoot, "app"),
    GHCR_TOKEN: "smoke-ghcr-token",
    GHCR_USERNAME: "smoke-ghcr-user",
  };

  if (process.platform === "win32") {
    const mountRoot = toDockerMountPath(tempRoot);
    return await runCommand("docker", [
      "run",
      "--rm",
      "-v",
      `${mountRoot}:/workspace`,
      "-w",
      "/workspace/app",
      "-e",
      `APP_IMAGE=${scenarioConfig.requestedImage}`,
      "-e",
      "DEPLOY_APP_DIR=/workspace/app",
      "-e",
      "DEPLOY_ENV_FILE=.env.docker",
      "-e",
      "DEPLOY_REF=main",
      "-e",
      "DEPLOY_LOG_TAIL_LINES=20",
      "-e",
      "DEPLOY_REPORT_ROOT=.deploy-reports",
      "-e",
      "DEPLOY_SMOKE_MAX_ATTEMPTS=2",
      "-e",
      "DEPLOY_SMOKE_WAIT_SECONDS=0",
      "-e",
      "FAKE_REPO_DIR=/workspace/app",
      "-e",
      "GHCR_TOKEN=smoke-ghcr-token",
      "-e",
      "GHCR_USERNAME=smoke-ghcr-user",
      "-e",
      "PATH=/workspace/fakebin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      windowsDockerImage,
      "sh",
      "-c",
      "chmod +x /workspace/fakebin/* /workspace/deploy-remote.sh && exec sh /workspace/deploy-remote.sh",
    ]);
  }

  return await runCommand("sh", [path.join(tempRoot, "deploy-remote.sh")], {
    cwd: path.join(tempRoot, "app"),
    env: {
      ...process.env,
      ...envBase,
      PATH: `${path.join(tempRoot, "fakebin")}${path.delimiter}${process.env.PATH || ""}`,
    },
  });
}

async function loadReportArtifacts(appDir) {
  const reportsRoot = path.join(appDir, ".deploy-reports");
  await assertFileExists(reportsRoot, "deploy report root");

  const entries = await readdir(reportsRoot, { withFileTypes: true });
  const deployEntries = entries.filter((entry) => entry.isDirectory() && entry.name !== "latest");
  assert(deployEntries.length === 1, `expected exactly one deploy report, found ${deployEntries.length}`);

  const reportDir = path.join(reportsRoot, deployEntries[0].name);
  const latestDir = path.join(reportsRoot, "latest");
  const summaryPath = path.join(reportDir, "summary.json");
  const latestSummaryPath = path.join(latestDir, "summary.json");
  const summaryMdPath = path.join(reportDir, "summary.md");

  await assertFileExists(summaryPath, "summary.json");
  await assertFileExists(latestSummaryPath, "latest summary.json");
  await assertFileExists(summaryMdPath, "summary.md");

  const summary = JSON.parse(await readFile(summaryPath, "utf8"));
  const latestSummary = JSON.parse(await readFile(latestSummaryPath, "utf8"));
  const summaryMd = await readFile(summaryMdPath, "utf8");

  return {
    latestDir,
    reportDir,
    summary,
    latestSummary,
    summaryMd,
  };
}

async function verifyScenarioArtifacts(tempRoot, scenarioConfig, result) {
  const appDir = path.join(tempRoot, "app");
  const { reportDir, latestDir, summary, latestSummary, summaryMd } = await loadReportArtifacts(appDir);
  const envFile = await readFile(path.join(appDir, ".env.docker"), "utf8");

  assert(result.code === scenarioConfig.expectedExitCode, `${scenarioConfig.name} exited with ${result.code}`);
  assert(summary.status === scenarioConfig.expectedStatus, `${scenarioConfig.name} status mismatch`);
  assert(
    summary.rollbackTriggered === scenarioConfig.expectedRollbackTriggered,
    `${scenarioConfig.name} rollbackTriggered mismatch`,
  );
  assert(summary.rollbackStatus === scenarioConfig.expectedRollbackStatus, `${scenarioConfig.name} rollbackStatus mismatch`);
  assert(summary.deploySmoke.status === scenarioConfig.expectedDeploySmokeStatus, `${scenarioConfig.name} deploy smoke mismatch`);
  assert(
    summary.rollbackSmoke.status === scenarioConfig.expectedRollbackSmokeStatus,
    `${scenarioConfig.name} rollback smoke mismatch`,
  );
  assert(summary.finalAppImage === scenarioConfig.expectedFinalImage, `${scenarioConfig.name} final image mismatch`);
  assert(summary.finalCommit === scenarioConfig.expectedFinalCommit, `${scenarioConfig.name} final commit mismatch`);
  assert(summary.previousAppImage === scenarioConfig.previousImage, `${scenarioConfig.name} previous image mismatch`);
  assert(summary.deployedCommit === scenarioConfig.deployedCommit, `${scenarioConfig.name} deployed commit mismatch`);
  assert(JSON.stringify(summary) === JSON.stringify(latestSummary), `${scenarioConfig.name} latest summary mismatch`);
  assertIncludes(envFile, `APP_IMAGE=${scenarioConfig.expectedFinalImage}`, `${scenarioConfig.name} env file`);
  assertIncludes(result.stdout, "DEPLOY_REPORT_DIR_RELATIVE=.deploy-reports/", `${scenarioConfig.name} stdout marker`);
  assertIncludes(result.stdout, "DEPLOY_REPORT_LATEST_RELATIVE=.deploy-reports/latest", `${scenarioConfig.name} latest marker`);
  assertIncludes(summaryMd, "# 远端部署报告", `${scenarioConfig.name} summary markdown`);
  assert(summary.finishedAt, `${scenarioConfig.name} should record finishedAt`);

  await assertFileExists(path.join(reportDir, `${scenarioConfig.expectedFinalDiagnosticsLabel}-docker-compose-ps.txt`), `${scenarioConfig.name} compose diagnostics`);
  await assertFileExists(path.join(reportDir, `${scenarioConfig.expectedFinalDiagnosticsLabel}-app-logs.txt`), `${scenarioConfig.name} app log diagnostics`);
  await assertFileExists(path.join(reportDir, "deploy-smoke-attempts.log"), `${scenarioConfig.name} deploy attempts`);
  await assertFileExists(path.join(reportDir, "deploy-health-last.txt"), `${scenarioConfig.name} deploy health body`);
  await assertFileExists(path.join(reportDir, "deploy-login-last.txt"), `${scenarioConfig.name} deploy login body`);
  await assertFileExists(path.join(latestDir, "summary.md"), `${scenarioConfig.name} latest summary markdown`);

  if (scenarioConfig.expectedRollbackTriggered) {
    await assertFileExists(path.join(reportDir, "rollback-smoke-attempts.log"), `${scenarioConfig.name} rollback attempts`);
    await assertFileExists(path.join(reportDir, "rollback-health-last.txt"), `${scenarioConfig.name} rollback health body`);
    await assertFileExists(path.join(reportDir, "rollback-login-last.txt"), `${scenarioConfig.name} rollback login body`);
  }
}

async function runScenario(scenarioConfig) {
  const tempRoot = await createScenarioRoot(scenarioConfig.name);

  try {
    await prepareScenarioEnvironment(tempRoot, scenarioConfig);
    const result = await runDeployScript(tempRoot, scenarioConfig);

    if (result.signal) {
      throw new Error(`${scenarioConfig.name} terminated by signal ${result.signal}`);
    }

    await verifyScenarioArtifacts(tempRoot, scenarioConfig, result);
    await rm(tempRoot, { force: true, recursive: true });
    console.log(`[ok] ${scenarioConfig.name}`);
  } catch (error) {
    throw new Error(`${scenarioConfig.name} failed: ${error.message}\nArtifacts kept at ${tempRoot}`);
  }
}

async function main() {
  const scenarios = [
    {
      name: "deploy-success",
      previousCommit: "commit-prev-success",
      deployedCommit: "commit-next-success",
      previousImage: "ghcr.io/example/app:prev-success",
      requestedImage: "ghcr.io/example/app:next-success",
      expectedDeploySmokeStatus: "passed",
      expectedExitCode: 0,
      expectedFinalCommit: "commit-next-success",
      expectedFinalDiagnosticsLabel: "deploy-final",
      expectedFinalImage: "ghcr.io/example/app:next-success",
      expectedRollbackSmokeStatus: "not_started",
      expectedRollbackStatus: "not_needed",
      expectedRollbackTriggered: false,
      expectedStatus: "succeeded",
    },
    {
      name: "deploy-rollback",
      previousCommit: "commit-prev-rollback",
      deployedCommit: "commit-next-rollback",
      previousImage: "ghcr.io/example/app:prev-rollback",
      requestedImage: "ghcr.io/example/app:bad-rollback",
      expectedDeploySmokeStatus: "failed",
      expectedExitCode: 1,
      expectedFinalCommit: "commit-prev-rollback",
      expectedFinalDiagnosticsLabel: "rollback-final",
      expectedFinalImage: "ghcr.io/example/app:prev-rollback",
      expectedRollbackSmokeStatus: "passed",
      expectedRollbackStatus: "succeeded",
      expectedRollbackTriggered: true,
      expectedStatus: "rolled_back",
    },
  ];

  for (const scenario of scenarios) {
    await runScenario(scenario);
  }

  console.log("deploy-remote smoke completed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
