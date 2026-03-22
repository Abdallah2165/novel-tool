import { spawn } from "node:child_process";
import process from "node:process";

const smokeScripts = [
  "smoke:auth-provider",
  "smoke:api-presets-e2e",
  "smoke:deploy-remote",
  "smoke:export-e2e",
  "smoke:generation-archive-e2e",
  "smoke:grok-e2e",
  "smoke:provider-matrix-e2e",
  "smoke:ingest-e2e",
  "smoke:onboarding-e2e",
  "smoke:mcp-generate",
  "smoke:mcp-e2e",
  "smoke:nonchapter-e2e",
  "smoke:research-e2e",
  "smoke:mainline-e2e",
];

const steps = [
  { label: "lint", npmArgs: ["run", "lint"] },
  { label: "typecheck", npmArgs: ["run", "typecheck"] },
  { label: "test", npmArgs: ["run", "test", "--", "--run"] },
  { label: "build", npmArgs: ["run", "build"] },
  ...smokeScripts.map((scriptName) => ({
    label: scriptName,
    npmArgs: ["run", scriptName],
  })),
];

function resolveNpmCommand() {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      argsPrefix: [process.env.npm_execpath],
    };
  }

  return {
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    argsPrefix: [],
  };
}

function formatDuration(startTime) {
  const totalSeconds = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

async function runStep(step, index, total) {
  const runner = resolveNpmCommand();
  const startedAt = Date.now();

  console.log(`\n[${index}/${total}] ${step.label}`);

  await new Promise((resolve, reject) => {
    const child = spawn(runner.command, [...runner.argsPrefix, ...step.npmArgs], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      if (signal) {
        reject(new Error(`${step.label} terminated by signal ${signal}`));
        return;
      }

      reject(new Error(`${step.label} exited with code ${code}`));
    });
  });

  console.log(`[ok] ${step.label} (${formatDuration(startedAt)})`);
}

async function main() {
  const startedAt = Date.now();

  for (const [index, step] of steps.entries()) {
    await runStep(step, index + 1, steps.length);
  }

  console.log(`\nRelease validation completed in ${formatDuration(startedAt)}.`);
}

main().catch((error) => {
  console.error(`\nRelease validation failed: ${error.message}`);
  process.exitCode = 1;
});
