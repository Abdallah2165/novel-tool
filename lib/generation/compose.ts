import "server-only";

import { ApiError } from "@/lib/api/http";
import { getKnowledgeDigest, loadKnowledgeBase } from "@/lib/knowledge";
import type { TaskType } from "@/lib/types/domain";

type PromptRoutingRow = {
  taskType: TaskType;
  promptFile: string;
  outputContract: string;
  fallbackPromptFile: string;
};

type SkillCompositionRow = {
  taskType: TaskType;
  skills: string[];
  notes: string;
};

type TaskTypeRow = {
  taskType: TaskType;
  label: string;
  description: string;
  requiresArtifacts: string[];
  supportsMcp: boolean;
  supportsSearch: boolean;
  outputContract: string;
};

export type ComposeTaskInput = {
  taskType: TaskType;
  userInstruction: string;
  projectContext: string;
  projectPromptOverlay?: string;
  projectSkillOverlay?: string;
  selectedReferences?: string;
  selectedMcpTools?: string;
  externalFacts?: string;
  externalPromptTemplate?: string;
  externalPromptLabel?: string;
  currentTime: string;
};

export async function resolveTaskDefinition(taskType: TaskType) {
  const knowledge = await loadKnowledgeBase();
  const taskTypes = knowledge.schemas["task-types.json"] as TaskTypeRow[];
  const promptRouting = knowledge.schemas["prompt-routing.json"] as PromptRoutingRow[];
  const skillComposition = knowledge.schemas["skill-composition.json"] as SkillCompositionRow[];

  const task = taskTypes.find((item) => item.taskType === taskType);
  const prompt = promptRouting.find((item) => item.taskType === taskType);
  const skills = skillComposition.find((item) => item.taskType === taskType);

  if (!task || !prompt || !skills) {
    throw new ApiError(500, "CONFIG_ERROR", `Missing task configuration for "${taskType}".`);
  }

  return { task, prompt, skills };
}

function fillTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => variables[key] ?? "");
}

export async function composeResolvedPrompt(input: ComposeTaskInput) {
  const knowledge = await loadKnowledgeBase();
  const digest = await getKnowledgeDigest();
  const { task, prompt, skills } = await resolveTaskDefinition(input.taskType);
  const promptTemplate =
    knowledge.prompts[prompt.promptFile] ?? knowledge.prompts[prompt.fallbackPromptFile];

  if (!promptTemplate) {
    throw new ApiError(500, "CONFIG_ERROR", `Prompt file missing for task "${input.taskType}".`);
  }

  const resolvedSkills = skills.skills.map((skillName) => ({
    name: skillName,
    content: knowledge.skills[`${skillName}.md`] ?? "",
  }));
  const resolvedSkillSet = input.projectSkillOverlay?.trim()
    ? [
        ...resolvedSkills,
        {
          name: "project_skill_pack",
          content: input.projectSkillOverlay.trim(),
        },
      ]
    : resolvedSkills;

  const resolvedPromptBody = fillTemplate(promptTemplate, {
    user_instruction: input.userInstruction,
    task_type: input.taskType,
    project_context: input.projectContext,
    project_prompt_overlay: input.projectPromptOverlay?.trim() || "无",
    knowledge_rules: digest,
    selected_skills: resolvedSkills.map((skill) => `# ${skill.name}\n${skill.content.trim()}`).join("\n\n"),
    project_skill_overlay: input.projectSkillOverlay?.trim() || "无",
    selected_references: input.selectedReferences ?? "无",
    selected_mcp_tools: input.selectedMcpTools ?? "无",
    external_facts: input.externalFacts ?? "无",
    output_contract: prompt.outputContract,
    current_time: input.currentTime,
  });
  const externalPromptBlock = input.externalPromptTemplate?.trim()
    ? [
        "",
        "外部提示模板（运行时注入）:",
        input.externalPromptLabel?.trim() ? `来源：${input.externalPromptLabel.trim()}` : "来源：external",
        input.externalPromptTemplate.trim(),
      ].join("\n")
    : "";
  const resolvedPrompt = `${resolvedPromptBody}${externalPromptBlock ? `\n\n${externalPromptBlock}` : ""}`;

  return {
    task,
    promptFile: prompt.promptFile,
    outputContract: prompt.outputContract,
    resolvedSkills: resolvedSkillSet,
    resolvedPrompt,
  };
}
