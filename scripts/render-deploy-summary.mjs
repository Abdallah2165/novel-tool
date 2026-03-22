import { access, appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      options[key] = "true";
      continue;
    }

    options[key] = value;
    index += 1;
  }

  return options;
}

async function fileExists(filePath) {
  if (!filePath) {
    return false;
  }

  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function escapeAnnotationValue(value) {
  return String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function statusLabel(status) {
  switch (status) {
    case "succeeded":
      return "部署成功";
    case "rolled_back":
      return "部署失败，已回滚";
    case "rollback_failed":
      return "部署失败，回滚失败";
    case "failed":
      return "部署失败";
    case "running":
      return "部署中";
    default:
      return `未知状态（${status || "unknown"}）`;
  }
}

function buildStructuredSummary(summary, options) {
  const lines = [
    "## 生产部署回传",
    "",
  ];

  if (options.imageRef) {
    lines.push(`- 目标镜像：\`${options.imageRef}\``);
  }

  if (options.deployRef) {
    lines.push(`- 目标 ref：\`${options.deployRef}\``);
  }

  if (summary) {
    lines.push(`- 部署结论：**${statusLabel(summary.status)}**`);
    lines.push(`- 状态说明：${summary.message || "_none_"}`);
    lines.push(`- 部署 ID：\`${summary.deployId || "_unknown_"}\``);
    lines.push(`- 最终 commit：\`${summary.finalCommit || "_unknown_"}\``);
    lines.push(`- 最终镜像：\`${summary.finalAppImage || "_empty_"}\``);
    lines.push(
      `- 首次部署 smoke：\`${summary.deploySmoke?.status || "unknown"}\`（${summary.deploySmoke?.attempts ?? 0} 次）`,
    );
    lines.push(
      `- 回滚状态：\`${summary.rollbackStatus || "unknown"}\` / 回滚 smoke：\`${summary.rollbackSmoke?.status || "unknown"}\``,
    );
  } else {
    lines.push("- 部署结论：**未取得远端报告**");
  }

  return lines.join("\n");
}

function buildAnnotation(summary, fetchErrorMessage) {
  if (summary) {
    const baseMessage = `${statusLabel(summary.status)}；${summary.message || "无附加说明"}`;
    const suffix = summary.deployId ? `（deployId=${summary.deployId}）` : "";

    if (summary.status === "succeeded") {
      return {
        level: "notice",
        title: "生产部署成功",
        message: `${baseMessage}${suffix}`,
      };
    }

    return {
      level: "error",
      title: "生产部署异常",
      message: `${baseMessage}${suffix}`,
    };
  }

  if (fetchErrorMessage) {
    return {
      level: "warning",
      title: "未取得远端部署报告",
      message: fetchErrorMessage,
    };
  }

  return {
    level: "warning",
    title: "未取得远端部署报告",
    message: "远端部署脚本结束后，没有在工作流中找到可读取的部署报告。",
  };
}

async function readConsoleTail(consoleLogPath, tailLines) {
  if (!(await fileExists(consoleLogPath))) {
    return "";
  }

  const content = await readFile(consoleLogPath, "utf8");
  const lines = content.split(/\r?\n/);
  return lines.slice(-tailLines).join("\n").trim();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const reportDir = options["report-dir"] || "";
  const consoleLogPath = options["console-log"] || "";
  const fetchErrorFilePath = options["fetch-error-file"] || "";
  const summaryFilePath = options["summary-file"] || process.env.GITHUB_STEP_SUMMARY || "";
  const tailLines = Number(options["console-tail-lines"] || "40");
  const summaryJsonPath = reportDir ? path.join(reportDir, "summary.json") : "";
  const summaryMdPath = reportDir ? path.join(reportDir, "summary.md") : "";

  let summary = null;
  let summaryMarkdown = "";
  let fetchErrorMessage = "";

  if (await fileExists(summaryJsonPath)) {
    summary = JSON.parse(await readFile(summaryJsonPath, "utf8"));
  }

  if (await fileExists(summaryMdPath)) {
    summaryMarkdown = await readFile(summaryMdPath, "utf8");
  }

  if (await fileExists(fetchErrorFilePath)) {
    fetchErrorMessage = (await readFile(fetchErrorFilePath, "utf8")).trim();
  }

  const sections = [buildStructuredSummary(summary, options)];

  if (summaryMarkdown) {
    sections.push(summaryMarkdown.trim());
  } else if (fetchErrorMessage) {
    sections.push(fetchErrorMessage);
  } else if (!summary) {
    sections.push("未能取得远端部署报告。");
  }

  const consoleTail = await readConsoleTail(consoleLogPath, tailLines);
  if (consoleTail) {
    sections.push(["## 远端控制台尾部", "", "```text", consoleTail, "```"].join("\n"));
  }

  const finalSummary = `${sections.filter(Boolean).join("\n\n")}\n`;
  if (summaryFilePath) {
    await appendFile(summaryFilePath, finalSummary, "utf8");
  } else {
    process.stdout.write(finalSummary);
  }

  const annotation = buildAnnotation(summary, fetchErrorMessage);
  process.stdout.write(
    `::${annotation.level} title=${escapeAnnotationValue(annotation.title)}::${escapeAnnotationValue(annotation.message)}\n`,
  );
}

main().catch((error) => {
  console.error(`render-deploy-summary failed: ${error.message}`);
  process.exitCode = 1;
});
