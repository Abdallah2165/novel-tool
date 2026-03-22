import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const runtimeRoots = ["app", "components", "lib"].map((segment) => path.join(projectRoot, segment));
const forbiddenTokens = [
  "参考资料/",
  "参考资料\\",
  "archive/reference-library",
  "archive\\reference-library",
  "archive/reference-sources",
  "archive\\reference-sources",
];
const archivedReferenceRoot = path.join(projectRoot, "archive", "reference-library");
const liveReferenceRoot = path.join(projectRoot, "参考资料");

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return walk(fullPath);
      }

      return [fullPath];
    }),
  );

  return nested.flat();
}

function isRuntimeSourceFile(filePath) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  if (!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(normalizedPath)) {
    return false;
  }

  return !/\.test\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(normalizedPath);
}

async function main() {
  const [hasArchivedReferenceRoot, hasLiveReferenceRoot] = await Promise.all([
    pathExists(archivedReferenceRoot),
    pathExists(liveReferenceRoot),
  ]);

  if (!hasArchivedReferenceRoot) {
    throw new Error(`Normalized reference library is missing: ${archivedReferenceRoot}`);
  }

  if (hasLiveReferenceRoot) {
    throw new Error(`Live raw source directory should not remain after archival: ${liveReferenceRoot}`);
  }

  const runtimeFiles = (
    await Promise.all(
      runtimeRoots.map(async (directory) => {
        if (!(await pathExists(directory))) {
          return [];
        }

        return walk(directory);
      }),
    )
  )
    .flat()
    .filter(isRuntimeSourceFile);

  const violations = [];

  for (const filePath of runtimeFiles) {
    const content = await readFile(filePath, "utf-8");
    const matchedToken = forbiddenTokens.find((token) => content.includes(token));
    if (!matchedToken) {
      continue;
    }

    violations.push({
      filePath,
      matchedToken,
    });
  }

  if (violations.length > 0) {
    throw new Error(
      `Runtime source independence check failed: ${violations
        .map((item) => `${item.filePath} -> ${item.matchedToken}`)
        .join("; ")}`,
    );
  }

  console.log(
    JSON.stringify({
      status: "ok",
      archivedReferenceRoot,
      runtimeFileCount: runtimeFiles.length,
      forbiddenTokenCount: forbiddenTokens.length,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
