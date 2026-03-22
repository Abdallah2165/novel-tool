#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import textwrap
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_ROOT = ROOT / "knowledge"
ARCHIVE_LIBRARY_ROOT = ROOT / "archive" / "reference-library"


def resolve_reference_root() -> Path:
    if ARCHIVE_LIBRARY_ROOT.exists():
        return ARCHIVE_LIBRARY_ROOT
    raise FileNotFoundError(
        "No normalized reference library was found. Expected "
        f"{ARCHIVE_LIBRARY_ROOT}."
    )


def dedent(text: str) -> str:
    return textwrap.dedent(text).strip() + "\n"


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2).rstrip() + "\n",
        encoding="utf-8",
    )


def numbered(items: list[str]) -> str:
    return "\n".join(f"{index}. {item}" for index, item in enumerate(items, start=1))


def bullets(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items)


def extract_archive_body(content: str) -> str:
    match = re.search(r"^## 归档正文\s*$", content, flags=re.MULTILINE)
    if not match:
        raise RuntimeError("Missing `## 归档正文` section in normalized archive document.")

    body = content[match.end():].strip()
    if not body:
        raise RuntimeError("Normalized archive document has an empty `## 归档正文` section.")

    return body


SOURCE_FILES = [
    {
        "file": "source_01_planning_rules.md",
        "materialFile": "file_memory_and_planning_rules.md",
        "materialLabel": "文件化规划与上下文规则",
        "sourceType": "archive_skill_markdown",
        "category": "文件化记忆",
        "sourceKind": "planning_skill",
        "themes": ["文件化记忆", "上下文窗口", "联网按需", "外显自检"],
        "note": "标准化整理后的主技能资料，提供文件化规划和本地优先的上下文规则。",
    },
    {
        "file": "source_02_chapter_state_rules.md",
        "materialFile": "chapter_engine_and_state_files.md",
        "materialLabel": "章节引擎与状态文件",
        "sourceType": "archive_skill_markdown",
        "category": "设定维护",
        "sourceKind": "chapter_engine_skill",
        "themes": ["状态卡优先", "账本维护", "伏笔池", "章节结算"],
        "note": "标准化整理后的章节引擎资料，强调状态卡、账本与伏笔池的协同。",
    },
    {
        "file": "source_03_research_style_rules.md",
        "materialFile": "research_and_prose_guidelines.md",
        "materialLabel": "考据与文风规则",
        "sourceType": "archive_guideline_markdown",
        "category": "联网与考据",
        "sourceKind": "search_source",
        "themes": ["搜索策略", "交叉验证", "回答合成", "写作去 AI 味"],
        "note": "标准化整理后的考据与写作风格资料，其中极端规则会在 canonical 中收敛。",
    },
    {
        "file": "source_04_research_style_rules_duplicate.md",
        "materialFile": "research_and_prose_guidelines_duplicate.md",
        "materialLabel": "考据与文风规则补充来源",
        "sourceType": "archive_guideline_markdown",
        "category": "联网与考据",
        "sourceKind": "search_source_duplicate",
        "themes": ["搜索策略", "交叉验证", "回答合成", "写作去 AI 味"],
        "note": "与主稿内容高度重复，保留用于来源映射和冲突核对。",
    },
    {
        "file": "source_05_platform_fit_workflow.md",
        "materialFile": "platform_fit_and_reference_absorption.md",
        "materialLabel": "平台适配与资料吸收流程",
        "sourceType": "archive_topic_markdown",
        "category": "写作流程",
        "sourceKind": "forum_topic",
        "themes": ["平台调研", "资料吸收", "设定搭建", "多模型互校"],
        "note": "标准化整理后的平台适配主稿，保留榜单调研、资料吸收与多模型互校步骤。",
    },
    {
        "file": "source_06_platform_fit_workflow_duplicate_01.md",
        "materialFile": "platform_fit_and_reference_absorption_duplicate_01.md",
        "materialLabel": "平台适配与资料吸收补充来源一",
        "sourceType": "archive_topic_markdown",
        "category": "写作流程",
        "sourceKind": "forum_topic_duplicate",
        "themes": ["平台调研", "资料吸收", "设定搭建", "多模型互校"],
        "note": "与主稿内容重复，保留用于确认同源资料在标准化整理后仍可追溯。",
    },
    {
        "file": "source_07_platform_fit_workflow_duplicate_02.md",
        "materialFile": "platform_fit_and_reference_absorption_duplicate_02.md",
        "materialLabel": "平台适配与资料吸收补充来源二",
        "sourceType": "archive_topic_markdown",
        "category": "写作流程",
        "sourceKind": "forum_topic_duplicate",
        "themes": ["平台调研", "资料吸收", "设定搭建", "多模型互校"],
        "note": "与主稿内容重复，保留用于确认同源资料在标准化整理后仍可对照。",
    },
    {
        "file": "source_08_platform_fit_workflow_duplicate_03.md",
        "materialFile": "platform_fit_and_reference_absorption_duplicate_03.md",
        "materialLabel": "平台适配与资料吸收补充来源三",
        "sourceType": "archive_topic_markdown",
        "category": "写作流程",
        "sourceKind": "forum_topic_duplicate",
        "themes": ["平台调研", "资料吸收", "设定搭建", "多模型互校"],
        "note": "与主稿内容重复，保留用于确认标准化归档后的内容稳定性。",
    },
]


def make_prompt(
    title: str,
    goals: list[str],
    hard_rules: list[str],
    outputs: list[str],
    extra_heading: str | None = None,
    extra_items: list[str] | None = None,
) -> str:
    parts = [
        f"# Prompt: {title}",
        "",
        "## Variables",
        "- `{{user_instruction}}`",
        "- `{{task_type}}`",
        "- `{{project_prompt_overlay}}`",
        "- `{{project_context}}`",
        "- `{{knowledge_rules}}`",
        "- `{{selected_skills}}`",
        "- `{{project_skill_overlay}}`",
        "- `{{selected_references}}`",
        "- `{{selected_mcp_tools}}`",
        "- `{{external_facts}}`",
        "- `{{output_contract}}`",
        "- `{{current_time}}`",
        "",
        "## System Prompt",
        f"你正在执行“{title}”任务。",
        "",
        "目标：",
        numbered(goals),
        "",
        "必须遵守：",
        numbered(hard_rules),
    ]
    if extra_heading and extra_items:
        parts.extend(["", f"{extra_heading}：", numbered(extra_items)])
    parts.extend(
        [
            "",
            "项目专属 Prompt Overlay：",
            "{{project_prompt_overlay}}",
            "",
            "项目上下文：",
            "{{project_context}}",
            "",
            "知识规则：",
            "{{knowledge_rules}}",
            "",
            "已启用 Skills：",
            "{{selected_skills}}",
            "",
            "项目专属 Skill Overlay：",
            "{{project_skill_overlay}}",
            "",
            "手动参考资料：",
            "{{selected_references}}",
            "",
            "MCP 工具：",
            "{{selected_mcp_tools}}",
            "",
            "外部事实：",
            "{{external_facts}}",
            "",
            "输出：",
            numbered(outputs),
            "",
            "用户指令：",
            "{{user_instruction}}",
            "",
            "输出合同：",
            "{{output_contract}}",
            "",
            "当前时间：",
            "{{current_time}}",
        ]
    )
    return "\n".join(parts).strip() + "\n"


def make_skill(
    name: str,
    role: str,
    responsibilities: list[str],
    guardrails: list[str],
    outputs: list[str],
) -> str:
    return dedent(
        f"""
        # Skill: {name}

        ## Role
        {role}

        ## Responsibilities
        {bullets(responsibilities)}

        ## Guardrails
        {bullets(guardrails)}

        ## Default Outputs
        {bullets(outputs)}
        """
    )


CANONICAL_FILES = {
    "canonical_workflow.md": dedent(
        """
        # Canonical Workflow

        本项目的正式工作流固定为“知识先行、任务装配、草稿优先、确认回填”。

        ## Memory Model

        - 把短期上下文视为易失缓存，把 `knowledge/` 和项目内 artifact 视为正式记忆。
        - 运行时只允许把 `knowledge/` 作为系统知识入口，不直接读取 `参考资料/` 参与生成。
        - 项目内所有创作、审稿和回填都依赖正式 artifact、Draft 与 revision，而不是聊天历史。

        ## Source Ingest Stage

        1. 先读取 `txt` / `md` 正文。
        2. 对静态 HTML 优先从 `data-preloaded -> post_stream.posts[0].cooked` 抽取首帖正文。
        3. 保留 onebox 标题、摘要和附件链接文本等二级上下文。
        4. 合并重复规则，并记录 active / merged / overridden 的归并状态。
        5. 产出 canonical、prompts、skills 与 schemas。

        ## Project Bootstrap Stage

        1. 创建项目后初始化标准 artifact、章节索引元数据与编辑器布局偏好。
        2. 先沉淀故事背景、世界规则、主角卡、势力角色、写作规则和状态文件。
        3. 任务开始前先检查缺失项；缺失时优先补文件，再继续生成正文。

        ## Context Loading

        - 续写、审稿、最小修法和状态同步时，优先读取 `99_当前状态卡.md`。
        - 只按任务需要扩窗；默认读取最近相关章节和必要设定文件，不机械追满 100 章。
        - 若存在长线伏笔、连续大战、跨地图推进或数值结算，再扩展到更多章节与账本文件。

        ## Runtime Task Loop

        1. 选择 `taskType`。
        2. 由 `prompt-routing.json` 解析 Prompt。
        3. 由 `skill-composition.json` 解析 Skills。
        4. 由 `context-priority.json` 解析上下文窗口。
        5. 只在需要外部事实时启用 MCP 或 GrokSearch。
        6. 生成结果先落到 Draft，不直接覆盖正式 artifact。
        7. 用户点击“接受并回填”后，才创建新 revision 并更新状态文件。

        ## Review And Accept Stage

        - 审稿结果必须按“问题 -> 证据 -> 最小修法”输出。
        - 最小修法只改已确认问题，不扩大改动范围。
        - 接受 Draft 时同步记录来源 draft、run、操作人、摘要和时间。
        """
    ),
    "source_priority.md": dedent(
        """
        # Source Priority

        ## Fixed Priority

        1. 用户本轮明确要求
        2. 项目正式 artifact 与最新 accepted revision
        3. `knowledge/` 中的 canonical / prompts / skills / schemas
        4. `sum2yang/novel-workflow` 的结构性补充经验
        5. 外部搜索结果与 MCP 结果

        ## Conflict Resolution

        - 用户明确要求永远高于既有计划和模板。
        - 最新正文高于旧设定、旧规划与旧状态卡。
        - 外部事实只能补现实世界信息，不能覆盖项目正式剧情事实。
        - 原始资料里的“强制每次联网”“固定使用某个模型”之类规则，统一视为候选来源，不直接进入 canonical。

        ## External Facts Boundary

        - 默认本地优先，只有考据、实时事实补充或用户明确要求时才引入联网结果。
        - 搜索结果必须记录来源，且只进入 Draft 或引用区，不直接落正式 artifact。
        """
    ),
    "task_taxonomy.md": dedent(
        """
        # Task Taxonomy

        | taskType | 目标 | 默认依赖 | 输出合同 | MCP/Search |
        | --- | --- | --- | --- | --- |
        | `ingest_sources` | 吸收原始资料并提炼规则 | 参考资料 / 标准化来源稿 | 结构化提炼结果 | 可选 |
        | `workflow_check` | 检查项目缺口与流程节点 | 项目 artifact + canonical | 缺口清单 | 否 |
        | `generate_setting` | 生成或补全设定 | 设定类 artifact | 设定草稿 + 回填补丁 | 否 |
        | `generate_outline` | 生成卷纲和节拍表 | 设定类 artifact + task_plan | 卷纲草稿 | 否 |
        | `generate_chapter` | 生成章节正文 | 状态卡 + 写作规则 + 最近章节 | 写作自检 + 正文 + 可选章节结算 + 回填补丁 | 可选 |
        | `review_content` | 找问题、证据和最小修法 | 当前正文 + 状态卡 + 写作规则 | 问题 -> 证据 -> 最小修法 | 可选 |
        | `minimal_fix` | 最小范围改写 | 原文 + 审稿意见 | 修改稿 + 修改摘要 | 否 |
        | `sync_state` | 同步状态文件 | 当前输出 + 状态类 artifact | 文件补丁清单 | 否 |
        | `research_fact_check` | 考据和事实核查 | 当前任务片段 + 搜索增强 | 事实结论 + 来源 | 是 |

        ## Review Related Tasks

        - 写作与审稿使用不同 Prompt / Skill 组合。
        - `review_content` 不生成完整正文，只负责问题定位和修法建议。
        - `minimal_fix` 只改已确认问题，不主动扩写剧情。

        ## Model Agnostic Runtime

        - 任务层不绑定具体供应商。
        - OpenAI、Gemini、Anthropic 只通过 endpoint 配置参与运行时选择。
        """
    ),
    "review_policy.md": dedent(
        """
        # Review Policy

        ## Review Goal

        优先找根因，不做表面夸赞；所有问题都要给证据和最小修法。

        ## Focus Areas

        - 人物 OOC
        - 时间线断裂
        - 利益链不成立
        - 考据错误
        - 爽点虚化
        - 配角工具人化
        - 语言机械与重复

        ## Logic Checks

        - 角色为什么要这么做
        - 这是否符合当前利益
        - 这是否符合既有人设与状态
        - 是否存在为了推剧情而让人物降智的写法

        ## Prose Rules

        - `Show, don't tell`
        - 避免 AI 味句式、空洞修辞和口号式说明
        - 同一段至少推进信息、态度、冲突或资源中的一项
        - 锁定题材风格，不混入不相干文体

        ## Fact Check Rules

        - 只在需要现实事实时搜索
        - 搜索结果至少做多源交叉验证
        - 输出要做综合归纳，不直接搬运原始结果

        ## Output Contract

        统一使用：

        1. 问题
        2. 证据
        3. 最小修法
        """
    ),
    "output_policy.md": dedent(
        """
        # Output Policy

        ## Draft First

        - 所有生成结果先进入 Draft。
        - 只有用户执行 accept，才创建正式 revision。
        - reject 只改变状态，不删除 run 与 draft。

        ## Visible Checks

        - 允许输出简短可见自检，但不能暴露思维链。
        - 轻量讨论、设定问答和单点润色可以省略自检模板。

        ## Chapter Outputs

        - `generate_chapter`：`写作自检 + 正文 + 可选章节结算 + 回填补丁`
        - `review_content`：`问题 -> 证据 -> 最小修法`
        - `minimal_fix`：`修改稿 + 修改摘要`
        - `sync_state`：`文件补丁清单`

        ## State Sync

        - 只要结果改变了当前章、敌我关系、资源、已知真相、伏笔状态或任务目标，就必须同步状态文件。
        - 吞噬、突破、卷末或大剧情节点要同步账本和伏笔池。
        """
    ),
}


PROMPT_FILES = {
    "ingest_sources.md": make_prompt(
        "资料吸收与规则提炼",
        [
            "只提炼高价值规则、流程、约束和模板。",
            "优先读取静态 HTML 的首帖正文，而不是只看 txt 附件。",
            "保留 onebox 标题、摘要和附件文本作为二级上下文。",
            "对重复规则归并，对冲突规则做来源标记。",
        ],
        [
            "用户要求优先。",
            "本地参考资料高于补充来源。",
            "不得把网页壳层当知识。",
            "也不得因为文件是静态 HTML 就跳过正文提炼。",
        ],
        [
            "提炼规则清单",
            "规则分组",
            "冲突与覆盖说明",
            "建议写入的 knowledge 文件",
            "每条规则对应的 HTML / txt 来源",
        ],
    ),
    "workflow_check.md": make_prompt(
        "工作流完整性检查",
        [
            "检查项目当前是否缺关键文件、缺状态或缺流程节点。",
            "判断当前项目是否满足继续生成正文的条件。",
            "输出缺口，不直接写正文。",
        ],
        [
            "优先以项目正式 artifact 为准。",
            "对缺失项给具体文件或模块名。",
            "不要用抽象建议替代可执行清单。",
        ],
        ["当前已有项", "缺失项", "风险项", "下一步建议"],
    ),
    "generate_setting.md": make_prompt(
        "设定生成",
        [
            "先遵守当前项目的风格和边界。",
            "只基于已确认资料和正式设定扩写。",
            "发现冲突时以项目正式设定为准。",
        ],
        [
            "不得伪装成正文。",
            "若影响状态文件，必须给出建议回填补丁。",
            "外部事实不能覆盖剧情事实。",
        ],
        ["结构化设定结果", "需要更新的项目文件", "建议回填补丁"],
    ),
    "generate_outline.md": make_prompt(
        "卷纲与节拍表生成",
        [
            "先锁定题材、风格、主角路线和收益逻辑。",
            "卷纲必须支撑后续章节，不允许空泛口号。",
            "给出主冲突、阶段目标、关键反馈点和旧伏笔回收点。",
        ],
        [
            "卷纲要能落到章节，不写抽象营销语。",
            "与正式设定冲突时优先保正式设定。",
            "需要回填的文件必须显式列出。",
        ],
        ["卷纲", "节拍表", "关键回收点", "需要更新的项目文件"],
    ),
    "generate_chapter.md": make_prompt(
        "正文生成",
        [
            "先读当前状态，再决定是否扩窗。",
            "保持题材一致、人物在线、利益链成立。",
            "每段至少推进信息、态度、冲突、资源中的一项。",
        ],
        [
            "不机械追满 100 章。",
            "不允许凭空掉设定。",
            "不允许人物降智推动剧情。",
            "外部事实只做补充，不覆盖剧情事实。",
        ],
        ["写作自检", "正文", "可选章节结算", "建议回填补丁"],
    ),
    "review_content.md": make_prompt(
        "质量审查",
        [
            "优先找根因，不做表面夸赞。",
            "只输出真正影响质量的问题。",
            "所有问题都要给证据和最小修法。",
        ],
        [
            "不得只给笼统建议。",
            "不得只给改后正文。",
            "需要回填状态时要显式指出。",
        ],
        ["问题", "证据", "最小修法"],
        extra_heading="检查重点",
        extra_items=[
            "OOC",
            "时间线断裂",
            "利益链问题",
            "爽点虚化",
            "配角工具人化",
            "考据错误",
            "语言机械与重复",
        ],
    ),
    "minimal_fix.md": make_prompt(
        "最小修法改写",
        [
            "仅修改已确认问题。",
            "不扩大改动范围。",
            "保留原有事实和剧情结论，除非用户允许重写。",
        ],
        [
            "修改范围必须与审稿意见对齐。",
            "不要顺手重构未确认片段。",
            "若影响状态文件，需要给出回填建议。",
        ],
        ["修改后的文本", "修改摘要", "建议回填项"],
    ),
    "sync_state.md": make_prompt(
        "状态回填",
        [
            "把本次结果同步到项目状态文件。",
            "只更新受影响的字段和表格。",
            "保持表头稳定、记录可追溯。",
        ],
        [
            "不得无差别重写整份文件。",
            "如果结果未影响当前阶段状态，要明确说明无需更新。",
            "补丁应能直接应用到目标文件。",
        ],
        ["需更新的文件清单", "每个文件的补丁内容", "本次同步摘要"],
    ),
    "research_fact_check.md": make_prompt(
        "考据与事实核查",
        [
            "只查询当前任务真正需要的事实。",
            "至少做多源交叉验证。",
            "只产出可落地到当前任务的事实结论。",
        ],
        [
            "不做无差别铺网。",
            "搜索结果只能作为外部事实补充。",
            "不能直接落正式 artifact。",
        ],
        ["结论", "来源摘要", "冲突点", "可写入项目的事实补充"],
    ),
}


SKILL_FILES = {
    "planner.md": make_skill(
        "planner",
        "负责把任务拆成稳定的执行步骤，并判断当前需要哪些 artifact、Prompt、Skill 与外部增强。",
        [
            "识别当前任务属于设定、正文、审稿、回填还是考据。",
            "优先检查缺失文件和缺失状态，再决定是否生成内容。",
            "在需要时给出补文件、补状态或补上下文的具体建议。",
        ],
        [
            "不直接越权改写用户已经确认的设定事实。",
            "不把聊天上下文当正式记忆。",
            "缺关键信息时优先指向应补充的 artifact。",
        ],
        ["任务拆解", "缺口判断", "上下文选择建议"],
    ),
    "setting_architect.md": make_skill(
        "setting_architect",
        "负责沉淀故事背景、世界规则、角色卡、势力关系和卷纲骨架。",
        [
            "基于正式资料补全设定，而不是另起一套平行世界观。",
            "锁定题材、风格、主角路线和收益逻辑。",
            "发现冲突时给出覆盖说明和回填建议。",
        ],
        [
            "不得把设定写成正文。",
            "不得混入不相干文体。",
            "不得让设定脱离当前项目商业定位。",
        ],
        ["结构化设定", "卷纲骨架", "回填补丁建议"],
    ),
    "writer.md": make_skill(
        "writer",
        "负责正文续写、补写和扩写，在既定设定与状态下推进冲突与收益。",
        [
            "默认先看状态卡和最近相关章节。",
            "用行动、细节和冲突推进，而不是大段解释。",
            "在关键收益节点补充章节结算与回填提示。",
        ],
        [
            "不机械追满 100 章。",
            "不凭空掉设定。",
            "不为了推剧情让人物降智。",
        ],
        ["写作自检", "正文", "可选章节结算"],
    ),
    "reviewer.md": make_skill(
        "reviewer",
        "负责找出正文、设定或输出中的关键问题，并给出证据和最小修法。",
        [
            "优先识别 OOC、时间线、利益链、考据和语言问题。",
            "把问题定位到可修正的段落、状态或设定条目。",
            "必要时附带状态文件和账本修订建议。",
        ],
        [
            "不做表面夸赞。",
            "不输出纯感受型评价。",
            "不以整篇重写代替最小修法。",
        ],
        ["问题清单", "证据定位", "最小修法"],
    ),
    "researcher.md": make_skill(
        "researcher",
        "负责现实事实考据、外部资料核验和搜索结果综合。",
        [
            "只在任务确实需要时联网。",
            "做多轮检索与多源交叉验证。",
            "把结果整理成能直接服务当前任务的事实结论。",
        ],
        [
            "不让外部事实覆盖剧情事实。",
            "不搬运原文结果。",
            "不在没有来源的情况下给确定性结论。",
        ],
        ["事实结论", "来源摘要", "冲突点"],
    ),
    "ledger_keeper.md": make_skill(
        "ledger_keeper",
        "负责把生成结果同步到状态卡、账本、伏笔池和进度记录。",
        [
            "只更新本次受影响的字段和表格。",
            "保持记录结构稳定和可追溯。",
            "在章节推进后同步任务计划、发现和进度。",
        ],
        [
            "不无差别重写整份文件。",
            "不跳过状态回填。",
            "不让账本与正文脱节。",
        ],
        ["补丁清单", "状态回填", "同步摘要"],
    ),
}


TASK_TYPES = [
    {
        "taskType": "ingest_sources",
        "label": "资料吸收",
        "description": "吸收参考资料并提炼结构化规则。",
        "requiresArtifacts": [],
        "defaultPrompt": "ingest_sources.md",
        "defaultSkills": ["planner", "researcher", "reviewer"],
        "supportsMcp": True,
        "supportsSearch": True,
        "outputContract": "结构化结果 + 需更新文件",
    },
    {
        "taskType": "workflow_check",
        "label": "流程检查",
        "description": "检查项目缺口与继续生产的前置条件。",
        "requiresArtifacts": ["task_plan", "progress", "current_state_card"],
        "defaultPrompt": "workflow_check.md",
        "defaultSkills": ["planner", "reviewer"],
        "supportsMcp": False,
        "supportsSearch": False,
        "outputContract": "结构化结果 + 需更新文件",
    },
    {
        "taskType": "generate_setting",
        "label": "设定生成",
        "description": "生成或补全故事设定与角色资料。",
        "requiresArtifacts": ["story_background", "world_bible", "protagonist_card", "factions_and_characters", "writing_rules"],
        "defaultPrompt": "generate_setting.md",
        "defaultSkills": ["planner", "setting_architect"],
        "supportsMcp": False,
        "supportsSearch": False,
        "outputContract": "结构化结果 + 需更新文件",
    },
    {
        "taskType": "generate_outline",
        "label": "大纲生成",
        "description": "生成卷纲、节拍表与回收点。",
        "requiresArtifacts": ["story_background", "world_bible", "protagonist_card", "writing_rules", "task_plan"],
        "defaultPrompt": "generate_outline.md",
        "defaultSkills": ["planner", "setting_architect", "writer"],
        "supportsMcp": False,
        "supportsSearch": False,
        "outputContract": "结构化结果 + 需更新文件",
    },
    {
        "taskType": "generate_chapter",
        "label": "章节生成",
        "description": "生成续写、补写或改写正文。",
        "requiresArtifacts": ["writing_rules", "task_plan", "findings", "progress", "current_state_card"],
        "defaultPrompt": "generate_chapter.md",
        "defaultSkills": ["writer", "reviewer"],
        "supportsMcp": True,
        "supportsSearch": True,
        "outputContract": "写作自检 + 正文 + 可选章节结算 + 回填补丁",
    },
    {
        "taskType": "review_content",
        "label": "内容审稿",
        "description": "定位问题、证据与最小修法。",
        "requiresArtifacts": ["writing_rules", "current_state_card"],
        "defaultPrompt": "review_content.md",
        "defaultSkills": ["reviewer", "researcher"],
        "supportsMcp": True,
        "supportsSearch": True,
        "outputContract": "问题 -> 证据 -> 最小修法",
    },
    {
        "taskType": "minimal_fix",
        "label": "最小修法",
        "description": "对已确认问题做最小范围修改。",
        "requiresArtifacts": ["writing_rules"],
        "defaultPrompt": "minimal_fix.md",
        "defaultSkills": ["reviewer", "writer"],
        "supportsMcp": False,
        "supportsSearch": False,
        "outputContract": "修改稿 + 修改摘要",
    },
    {
        "taskType": "sync_state",
        "label": "状态回填",
        "description": "把生成结果同步到状态类文件。",
        "requiresArtifacts": ["findings", "progress", "current_state_card"],
        "defaultPrompt": "sync_state.md",
        "defaultSkills": ["ledger_keeper", "planner"],
        "supportsMcp": False,
        "supportsSearch": False,
        "outputContract": "文件补丁清单",
    },
    {
        "taskType": "research_fact_check",
        "label": "考据核查",
        "description": "进行现实事实考据与实时信息补充。",
        "requiresArtifacts": ["writing_rules", "current_state_card"],
        "defaultPrompt": "research_fact_check.md",
        "defaultSkills": ["researcher", "reviewer"],
        "supportsMcp": True,
        "supportsSearch": True,
        "outputContract": "事实结论 + 来源",
    },
]


CONTEXT_PRIORITY = [
    {
        "taskType": "ingest_sources",
        "priorityOrder": ["user_instruction", "selected_references", "knowledge_rules", "external_facts"],
        "defaultWindow": {"maxReferenceDocs": 12, "maxSourceChars": 60000, "includeHtmlPrimaryPost": True},
        "expansionRules": [
            {"when": "存在来源冲突或规则重复", "expandTo": "相关来源全文与冲突摘要"},
            {"when": "HTML 含附件或 onebox", "expandTo": "保留链接标题、附件文本与摘要"},
        ],
    },
    {
        "taskType": "workflow_check",
        "priorityOrder": ["user_instruction", "project_artifacts", "knowledge_rules"],
        "defaultWindow": {"maxArtifacts": 10, "includeDrafts": True, "preferAcceptedRevisions": True},
        "expansionRules": [
            {"when": "状态文件缺失", "expandTo": "artifact-registry 与 file-templates"},
            {"when": "任务流无法闭环", "expandTo": "prompt-routing 与 skill-composition"},
        ],
    },
    {
        "taskType": "generate_setting",
        "priorityOrder": ["user_instruction", "project_setting_artifacts", "knowledge_rules", "selected_references"],
        "defaultWindow": {"maxArtifacts": 6, "includeLatestAccepted": True, "maxReferenceChars": 16000},
        "expansionRules": [
            {"when": "存在旧设定冲突", "expandTo": "findings 与相关 revision 摘要"},
            {"when": "用户要求补真实世界事实", "expandTo": "external_facts"},
        ],
    },
    {
        "taskType": "generate_outline",
        "priorityOrder": ["user_instruction", "project_setting_artifacts", "task_plan", "knowledge_rules"],
        "defaultWindow": {"maxArtifacts": 7, "includeLatestAccepted": True, "chapterLookback": 0},
        "expansionRules": [
            {"when": "需要回收长线伏笔", "expandTo": "pending_hooks 与 findings"},
            {"when": "已有旧卷纲", "expandTo": "outline_master 最新 revision"},
        ],
    },
    {
        "taskType": "generate_chapter",
        "priorityOrder": ["user_instruction", "current_state_card", "writing_rules", "recent_chapters", "findings", "progress", "knowledge_rules", "external_facts"],
        "defaultWindow": {"chapterLookback": 3, "maxArtifacts": 6, "includeDraftIfEditing": True, "preferStateCard": True},
        "expansionRules": [
            {"when": "长线伏笔回收或连续大战", "expandTo": "recent_chapters:10"},
            {"when": "吞噬/突破/卷末/地图切换", "expandTo": "particle_ledger + pending_hooks"},
        ],
    },
    {
        "taskType": "review_content",
        "priorityOrder": ["user_instruction", "current_state_card", "current_draft_or_revision", "writing_rules", "knowledge_rules", "external_facts"],
        "defaultWindow": {"chapterLookback": 2, "maxArtifacts": 5, "includeCurrentDraft": True},
        "expansionRules": [
            {"when": "疑似设定冲突", "expandTo": "相关设定文件与 findings"},
            {"when": "疑似事实错误", "expandTo": "external_facts 与 research_fact_check"},
        ],
    },
    {
        "taskType": "minimal_fix",
        "priorityOrder": ["user_instruction", "review_report", "current_draft_or_revision", "writing_rules", "current_state_card"],
        "defaultWindow": {"maxArtifacts": 4, "includeCurrentDraft": True, "chapterLookback": 1},
        "expansionRules": [
            {"when": "修法影响状态", "expandTo": "current_state_card 与 progress"},
            {"when": "修法触及伏笔/数值", "expandTo": "pending_hooks + particle_ledger"},
        ],
    },
    {
        "taskType": "sync_state",
        "priorityOrder": ["user_instruction", "current_state_card", "findings", "progress", "pending_hooks", "particle_ledger"],
        "defaultWindow": {"maxArtifacts": 6, "includeAcceptedOnly": False, "includeCurrentDraft": True},
        "expansionRules": [
            {"when": "当前结果涉及大节点", "expandTo": "task_plan 与相关 outline"},
            {"when": "当前结果涉及角色关系变更", "expandTo": "character_relationships"},
        ],
    },
    {
        "taskType": "research_fact_check",
        "priorityOrder": ["user_instruction", "current_state_card", "selected_references", "knowledge_rules", "external_facts"],
        "defaultWindow": {"maxArtifacts": 4, "searchBudgetSeconds": 60, "maxFactItems": 8},
        "expansionRules": [
            {"when": "出现事实冲突", "expandTo": "更多交叉来源与冲突摘要"},
            {"when": "需要写回项目", "expandTo": "对应 artifact 的补丁建议"},
        ],
    },
]


ARTIFACT_REGISTRY = [
    {"artifactKey": "story_background", "filename": "story_background.md", "kind": "project_setting", "required": True, "template": "story_background", "createdAtInit": True},
    {"artifactKey": "world_bible", "filename": "world_bible.md", "kind": "project_setting", "required": True, "template": "world_bible", "createdAtInit": True},
    {"artifactKey": "protagonist_card", "filename": "protagonist_card.md", "kind": "project_setting", "required": True, "template": "protagonist_card", "createdAtInit": True},
    {"artifactKey": "factions_and_characters", "filename": "factions_and_characters.md", "kind": "project_setting", "required": True, "template": "factions_and_characters", "createdAtInit": True},
    {"artifactKey": "writing_rules", "filename": "writing_rules.md", "kind": "project_setting", "required": True, "template": "writing_rules", "createdAtInit": True},
    {"artifactKey": "task_plan", "filename": "task_plan.md", "kind": "project_state", "required": True, "template": "task_plan", "createdAtInit": True},
    {"artifactKey": "findings", "filename": "findings.md", "kind": "project_state", "required": True, "template": "findings", "createdAtInit": True},
    {"artifactKey": "progress", "filename": "progress.md", "kind": "project_state", "required": True, "template": "progress", "createdAtInit": True},
    {"artifactKey": "character_relationships", "filename": "character_relationships.md", "kind": "project_state", "required": True, "template": "character_relationships", "createdAtInit": True},
    {"artifactKey": "current_state_card", "filename": "99_当前状态卡.md", "kind": "project_state", "required": True, "template": "current_state_card", "createdAtInit": True},
    {"artifactKey": "pending_hooks", "filename": "pending_hooks.md", "kind": "hook_pool", "required": False, "template": "pending_hooks", "createdAtInit": False},
    {"artifactKey": "particle_ledger", "filename": "particle_ledger.md", "kind": "ledger", "required": False, "template": "particle_ledger", "createdAtInit": False},
    {"artifactKey": "outline_master", "filename": "outline_master.md", "kind": "project_outline", "required": False, "template": "outline_master", "createdAtInit": False},
]


PROMPT_ROUTING = [
    {"taskType": "ingest_sources", "promptFile": "ingest_sources.md", "outputContract": "结构化结果 + 需更新文件", "fallbackPromptFile": "workflow_check.md"},
    {"taskType": "workflow_check", "promptFile": "workflow_check.md", "outputContract": "结构化结果 + 需更新文件", "fallbackPromptFile": "workflow_check.md"},
    {"taskType": "generate_setting", "promptFile": "generate_setting.md", "outputContract": "结构化结果 + 需更新文件", "fallbackPromptFile": "workflow_check.md"},
    {"taskType": "generate_outline", "promptFile": "generate_outline.md", "outputContract": "结构化结果 + 需更新文件", "fallbackPromptFile": "generate_setting.md"},
    {"taskType": "generate_chapter", "promptFile": "generate_chapter.md", "outputContract": "写作自检 + 正文 + 可选章节结算 + 回填补丁", "fallbackPromptFile": "review_content.md"},
    {"taskType": "review_content", "promptFile": "review_content.md", "outputContract": "问题 -> 证据 -> 最小修法", "fallbackPromptFile": "workflow_check.md"},
    {"taskType": "minimal_fix", "promptFile": "minimal_fix.md", "outputContract": "修改稿 + 修改摘要", "fallbackPromptFile": "review_content.md"},
    {"taskType": "sync_state", "promptFile": "sync_state.md", "outputContract": "文件补丁清单", "fallbackPromptFile": "workflow_check.md"},
    {"taskType": "research_fact_check", "promptFile": "research_fact_check.md", "outputContract": "事实结论 + 来源", "fallbackPromptFile": "review_content.md"},
]


SKILL_COMPOSITION = [
    {"taskType": "ingest_sources", "skills": ["planner", "researcher", "reviewer"], "notes": "先提炼规则，再核对来源冲突并输出结构化结果。"},
    {"taskType": "workflow_check", "skills": ["planner", "reviewer"], "notes": "先查缺口，再判断风险与继续条件。"},
    {"taskType": "generate_setting", "skills": ["planner", "setting_architect"], "notes": "先锁定边界，再补齐设定。"},
    {"taskType": "generate_outline", "skills": ["planner", "setting_architect", "writer"], "notes": "先确定卷纲骨架，再让 writer 细化节拍。"},
    {"taskType": "generate_chapter", "skills": ["writer", "reviewer"], "notes": "writer 负责正文推进，reviewer 负责即时风险扫描。"},
    {"taskType": "review_content", "skills": ["reviewer", "researcher"], "notes": "reviewer 找问题，researcher 负责事实核查。"},
    {"taskType": "minimal_fix", "skills": ["reviewer", "writer"], "notes": "reviewer 限定范围，writer 只做最小修法。"},
    {"taskType": "sync_state", "skills": ["ledger_keeper", "planner"], "notes": "ledger_keeper 生成补丁，planner 校验受影响文件。"},
    {"taskType": "research_fact_check", "skills": ["researcher", "reviewer"], "notes": "researcher 取事实，reviewer 过滤无关噪音。"},
]


FILE_TEMPLATES = [
    {"templateKey": "story_background", "filename": "story_background.md", "sections": ["题材定位", "故事前提", "核心矛盾", "读者收益逻辑"], "tableSchemas": []},
    {"templateKey": "world_bible", "filename": "world_bible.md", "sections": ["世界规则", "地图与地理", "能力体系", "禁忌与限制"], "tableSchemas": []},
    {"templateKey": "protagonist_card", "filename": "protagonist_card.md", "sections": ["角色定位", "核心动机", "能力与短板", "关系锚点"], "tableSchemas": []},
    {"templateKey": "factions_and_characters", "filename": "factions_and_characters.md", "sections": ["势力清单", "主要角色", "利益链", "敌我格局"], "tableSchemas": []},
    {"templateKey": "writing_rules", "filename": "writing_rules.md", "sections": ["平台与题材", "风格边界", "主角路线", "禁写清单", "输出要求"], "tableSchemas": []},
    {"templateKey": "task_plan", "filename": "task_plan.md", "sections": ["目标", "当前阶段", "关键问题", "决策记录", "风险与阻塞"], "tableSchemas": []},
    {"templateKey": "findings", "filename": "findings.md", "sections": ["发现记录"], "tableSchemas": ["findings_table"]},
    {"templateKey": "progress", "filename": "progress.md", "sections": ["进度记录"], "tableSchemas": ["progress_table"]},
    {"templateKey": "character_relationships", "filename": "character_relationships.md", "sections": ["人物关系矩阵"], "tableSchemas": ["character_relationships_table"]},
    {"templateKey": "current_state_card", "filename": "99_当前状态卡.md", "sections": ["当前状态"], "tableSchemas": ["current_state_table"]},
    {"templateKey": "pending_hooks", "filename": "pending_hooks.md", "sections": ["待回收伏笔"], "tableSchemas": ["pending_hooks_table"]},
    {"templateKey": "particle_ledger", "filename": "particle_ledger.md", "sections": ["资源账本"], "tableSchemas": ["particle_ledger_table"]},
    {"templateKey": "outline_master", "filename": "outline_master.md", "sections": ["卷纲", "节拍表", "回收点"], "tableSchemas": []},
]


SOURCE_EXTRACTION_POLICY = [
    {
        "sourceType": "txt",
        "primarySelectors": ["raw_text"],
        "fallbackSelectors": ["utf8_ignore_errors"],
        "ignorePatterns": [],
        "keepLinkMetadata": True,
        "keepAttachmentText": True,
    },
    {
        "sourceType": "markdown",
        "primarySelectors": ["raw_markdown"],
        "fallbackSelectors": ["utf8_ignore_errors"],
        "ignorePatterns": [],
        "keepLinkMetadata": True,
        "keepAttachmentText": True,
    },
    {
        "sourceType": "html_static_topic",
        "primarySelectors": ["#data-preloaded -> topic_* -> post_stream.posts[0].cooked"],
        "fallbackSelectors": ["visible_topic_body", "meta[property='og:description']", "meta[name='twitter:description']"],
        "ignorePatterns": ["script", "style", "svg", "forum_nav", "ad_slot", "footer", "decorative_image"],
        "keepLinkMetadata": True,
        "keepAttachmentText": True,
    },
    {
        "sourceType": "html_attachment_text",
        "primarySelectors": ["attachment_raw_text"],
        "fallbackSelectors": ["attachment_link_label"],
        "ignorePatterns": [],
        "keepLinkMetadata": True,
        "keepAttachmentText": True,
    },
    {
        "sourceType": "html_attachment_binary",
        "primarySelectors": ["attachment_link_label"],
        "fallbackSelectors": ["lightbox_title"],
        "ignorePatterns": ["binary_payload"],
        "keepLinkMetadata": True,
        "keepAttachmentText": False,
    },
]


EDITOR_LAYOUT = [
    {
        "pageType": "chapter_editor",
        "layoutMode": "three_pane",
        "leftPanel": ["chapter_list", "project_nav"],
        "centerPanel": ["chapter_header", "novel_editor"],
        "rightPanel": ["generation_actions", "model_panel", "context_panel"],
        "editorEngine": "codemirror6",
        "storageFormat": "markdown_artifact",
        "inputMode": "plain_text_novel",
        "autosaveIntervalMs": 5000,
        "focusModeEnabled": True,
        "visualPreset": "qidian_tomato_minimal",
    },
    {
        "pageType": "review_editor",
        "layoutMode": "three_pane",
        "leftPanel": ["source_text"],
        "centerPanel": ["review_findings"],
        "rightPanel": ["candidate_revision", "diff_panel", "accept_actions"],
        "editorEngine": "codemirror6",
        "storageFormat": "markdown_artifact",
        "inputMode": "plain_text_novel",
        "autosaveIntervalMs": 5000,
        "focusModeEnabled": False,
        "visualPreset": "qidian_tomato_minimal",
    },
]


RULE_MAP = [
    {
        "ruleId": "file_memory.persistent_context",
        "category": "文件化记忆",
        "summary": "把上下文当易失内存，把文件系统当持久记忆；复杂任务优先落文件。",
        "sourceFile": "source_01_planning_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "planning_skill",
        "mergedInto": "canonical_workflow.memory_model",
        "status": "active",
    },
    {
        "ruleId": "file_memory.planning_triplet",
        "category": "文件化记忆",
        "summary": "复杂任务维护 task_plan.md、findings.md、progress.md，并在阶段推进时同步更新。",
        "sourceFile": "source_01_planning_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "planning_skill",
        "mergedInto": "canonical_workflow.state_files",
        "status": "active",
    },
    {
        "ruleId": "file_memory.reuse_existing_records",
        "category": "文件化记忆",
        "summary": "已有状态文件优先复用，不要另起平行文件体系。",
        "sourceFile": "source_01_planning_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "planning_skill",
        "mergedInto": "canonical_workflow.state_files",
        "status": "active",
    },
    {
        "ruleId": "context.priority.latest_text_over_old_plan",
        "category": "上下文装配",
        "summary": "最新正文高于旧设定与旧规划；用户明确重构时允许覆盖旧设定，但需说明范围。",
        "sourceFile": "source_01_planning_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "planning_skill",
        "mergedInto": "source_priority.runtime_context_order",
        "status": "active",
    },
    {
        "ruleId": "context.priority.real_facts_only",
        "category": "上下文装配",
        "summary": "联网结果只能补真实世界事实，不能覆盖小说已有剧情事实。",
        "sourceFile": "source_01_planning_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "planning_skill",
        "mergedInto": "source_priority.external_facts_boundary",
        "status": "active",
    },
    {
        "ruleId": "context.window.status_card_first",
        "category": "上下文装配",
        "summary": "涉及续写、审稿、复盘或账本维护时，先读 99_当前状态卡，再决定是否扩窗。",
        "sourceFile": "source_02_chapter_state_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "chapter_engine_skill",
        "mergedInto": "canonical_workflow.context_loading",
        "status": "active",
    },
    {
        "ruleId": "context.window.minimal_context",
        "category": "上下文装配",
        "summary": "不要机械追满 100 章；优先读取最近相关章节，只有长线伏笔、连续大战或跨地图推进时才扩窗。",
        "sourceFile": "source_02_chapter_state_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "chapter_engine_skill",
        "mergedInto": "canonical_workflow.context_loading",
        "status": "active",
    },
    {
        "ruleId": "workflow.platform_fit_research",
        "category": "写作流程",
        "summary": "先研究目标平台和题材榜单，再吸收参考小说，确保生成结果符合平台风格和收益逻辑。",
        "sourceFile": "source_05_platform_fit_workflow.md",
        "sourceType": "html_static_topic",
        "extractionMethod": "html_data_preloaded_post_stream_posts_0_cooked",
        "sourceKind": "forum_topic",
        "mergedInto": "canonical_workflow.source_ingest_stage",
        "status": "active",
    },
    {
        "ruleId": "workflow.extract_reference_styles",
        "category": "写作流程",
        "summary": "分批吸收参考资料，并提炼每本参考小说的写法、风格和适配点。",
        "sourceFile": "source_05_platform_fit_workflow.md",
        "sourceType": "html_static_topic",
        "extractionMethod": "html_data_preloaded_post_stream_posts_0_cooked",
        "sourceKind": "forum_topic",
        "mergedInto": "canonical_workflow.source_ingest_stage",
        "status": "active",
    },
    {
        "ruleId": "workflow.story_setup_sequence",
        "category": "写作流程",
        "summary": "先做故事背景，再做体系设定、主角与外挂、势力人物、写作风格和路线。",
        "sourceFile": "source_05_platform_fit_workflow.md",
        "sourceType": "html_static_topic",
        "extractionMethod": "html_data_preloaded_post_stream_posts_0_cooked",
        "sourceKind": "forum_topic",
        "mergedInto": "canonical_workflow.project_bootstrap_stage",
        "status": "active",
    },
    {
        "ruleId": "workflow.fill_missing_artifacts",
        "category": "设定维护",
        "summary": "让系统检查缺失文件，并补充待回收伏笔、主角表、写作记录、关键设定和人物关系文件。",
        "sourceFile": "source_05_platform_fit_workflow.md",
        "sourceType": "html_static_topic",
        "extractionMethod": "html_data_preloaded_post_stream_posts_0_cooked",
        "sourceKind": "forum_topic",
        "mergedInto": "canonical_workflow.project_bootstrap_stage",
        "status": "active",
    },
    {
        "ruleId": "workflow.chapter_split_storage",
        "category": "文件化记忆",
        "summary": "正文按分卷或单章拆文件，避免一个文件塞太多章节导致读取遗漏。",
        "sourceFile": "source_05_platform_fit_workflow.md",
        "sourceType": "html_static_topic",
        "extractionMethod": "html_data_preloaded_post_stream_posts_0_cooked",
        "sourceKind": "forum_topic",
        "mergedInto": "canonical_workflow.project_bootstrap_stage",
        "status": "active",
    },
    {
        "ruleId": "workflow.dual_prompt_tracks",
        "category": "写作流程",
        "summary": "写作用与审稿用提示词分开维护，审稿链路禁止直接生成正文。",
        "sourceFile": "source_05_platform_fit_workflow.md",
        "sourceType": "html_static_topic",
        "extractionMethod": "html_data_preloaded_post_stream_posts_0_cooked",
        "sourceKind": "forum_topic",
        "mergedInto": "task_taxonomy.review_related_tasks",
        "status": "active",
    },
    {
        "ruleId": "workflow.multi_model_cross_check",
        "category": "写作流程",
        "summary": "拆文件后可用多个模型交叉检查问题，再回到主工作流统一修订。",
        "sourceFile": "source_05_platform_fit_workflow.md",
        "sourceType": "html_static_topic",
        "extractionMethod": "html_data_preloaded_post_stream_posts_0_cooked",
        "sourceKind": "forum_topic",
        "mergedInto": "canonical_workflow.review_and_accept_stage",
        "status": "active",
    },
    {
        "ruleId": "review.visible_self_check",
        "category": "审稿规则",
        "summary": "允许在正文前输出简短外显自检，但不要输出思维链或脑内报告。",
        "sourceFile": "source_01_planning_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "planning_skill",
        "mergedInto": "output_policy.visible_checks",
        "status": "active",
    },
    {
        "ruleId": "review.problem_evidence_fix",
        "category": "审稿规则",
        "summary": "质量审查按“问题 -> 证据 -> 最小修法”输出；若影响状态或数值，也要给记录修订方案。",
        "sourceFile": "source_02_chapter_state_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "chapter_engine_skill",
        "mergedInto": "review_policy.output_contract",
        "status": "active",
    },
    {
        "ruleId": "review.focus_core_failures",
        "category": "审稿规则",
        "summary": "重点检查 OOC、时间线、利益链、年代错误、配角工具人化、爽点虚化和语言重复。",
        "sourceFile": "source_01_planning_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "planning_skill",
        "mergedInto": "review_policy.focus_areas",
        "status": "active",
    },
    {
        "ruleId": "state.current_state_is_single_source",
        "category": "设定维护",
        "summary": "99_当前状态卡 是唯一当前时间点覆盖文件；章节推进、审稿和回修都会回写它。",
        "sourceFile": "source_02_chapter_state_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "chapter_engine_skill",
        "mergedInto": "canonical_workflow.state_files",
        "status": "active",
    },
    {
        "ruleId": "state.ledger_and_hooks",
        "category": "设定维护",
        "summary": "particle_ledger 与 pending_hooks 分别记录数值锚点和待回收伏笔，并与正文/状态卡同步。",
        "sourceFile": "source_02_chapter_state_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "chapter_engine_skill",
        "mergedInto": "canonical_workflow.state_files",
        "status": "active",
    },
    {
        "ruleId": "state.chapter_settlement",
        "category": "设定维护",
        "summary": "吞噬、突破、卷末或大节点后追加章节结算，并回填状态卡、账本和伏笔池。",
        "sourceFile": "source_02_chapter_state_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "chapter_engine_skill",
        "mergedInto": "output_policy.chapter_outputs",
        "status": "active",
    },
    {
        "ruleId": "network.local_first_on_demand",
        "category": "联网与考据",
        "summary": "本地优先、联网按需；不要默认每次都联网搜索。",
        "sourceFile": "source_01_planning_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "planning_skill",
        "mergedInto": "source_priority.external_facts_boundary",
        "status": "active",
    },
    {
        "ruleId": "network.cross_validate_then_synthesize",
        "category": "联网与考据",
        "summary": "搜索时做多轮检索、2 到 3 个权威来源交叉验证，并做综合分析而不是搬运。",
        "sourceFile": "source_03_research_style_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "search_source",
        "mergedInto": "review_policy.fact_check_rules",
        "status": "merged",
    },
    {
        "ruleId": "network.real_world_research_role",
        "category": "联网与考据",
        "summary": "历史考据只服务于真实世界事实核查，如年代、人物、政策、行业事件等。",
        "sourceFile": "source_03_research_style_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "search_source",
        "mergedInto": "task_taxonomy.research_fact_check",
        "status": "merged",
    },
    {
        "ruleId": "writing.show_dont_tell",
        "category": "写作流程",
        "summary": "用细节和行动证明人物与冲突，而不是大段解释式叙述。",
        "sourceFile": "source_03_research_style_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "search_source",
        "mergedInto": "review_policy.prose_rules",
        "status": "active",
    },
    {
        "ruleId": "writing.avoid_ai_patterns",
        "category": "写作流程",
        "summary": "避免重复句式、空洞华丽词藻和机械逻辑，多用动词、具体场景和自然转折。",
        "sourceFile": "source_03_research_style_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "search_source",
        "mergedInto": "review_policy.prose_rules",
        "status": "active",
    },
    {
        "ruleId": "writing.logic_checks",
        "category": "写作流程",
        "summary": "写每个情节时都要追问动机、利益和人设一致性，避免为了推剧情让人物降智。",
        "sourceFile": "source_03_research_style_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "search_source",
        "mergedInto": "review_policy.logic_checks",
        "status": "active",
    },
    {
        "ruleId": "writing.no_cross_genre_mix",
        "category": "写作流程",
        "summary": "锁定题材和风格边界，禁止在同一作品里混入不相干文体。",
        "sourceFile": "source_02_chapter_state_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "chapter_engine_skill",
        "mergedInto": "review_policy.prose_rules",
        "status": "active",
    },
    {
        "ruleId": "output.no_chain_of_thought",
        "category": "输出规则",
        "summary": "对外只给结论、自检和结构化结果，不暴露内部推理过程。",
        "sourceFile": "source_01_planning_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "planning_skill",
        "mergedInto": "output_policy.visible_checks",
        "status": "active",
    },
    {
        "ruleId": "network.always_search_everything",
        "category": "联网与考据",
        "summary": "所有回答强制联网搜索。",
        "sourceFile": "source_03_research_style_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "search_source",
        "mergedInto": "source_priority.external_facts_boundary",
        "status": "overridden",
    },
    {
        "ruleId": "path.hardcoded_local_drives",
        "category": "设定维护",
        "summary": "把特定机器上的 E 盘路径当成固定项目布局。",
        "sourceFile": "source_02_chapter_state_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "chapter_engine_skill",
        "mergedInto": "canonical_workflow.state_files",
        "status": "overridden",
    },
    {
        "ruleId": "model.provider_preference_gemini_first",
        "category": "写作流程",
        "summary": "把 Gemini/Studio 固定视为正文首选，Codex 只用于找问题和更新状态。",
        "sourceFile": "source_05_platform_fit_workflow.md",
        "sourceType": "html_static_topic",
        "extractionMethod": "html_data_preloaded_post_stream_posts_0_cooked",
        "sourceKind": "forum_topic",
        "mergedInto": "task_taxonomy.model_agnostic_runtime",
        "status": "overridden",
    },
    {
        "ruleId": "tone.snarky_expert_persona",
        "category": "输出规则",
        "summary": "固定要求犀利、轻嘲讽的专家人设和强个性语气。",
        "sourceFile": "source_03_research_style_rules.md",
        "sourceType": "txt",
        "extractionMethod": "direct_text_read",
        "sourceKind": "search_source",
        "mergedInto": "output_policy.visible_checks",
        "status": "overridden",
    },
]


def extract_markdown_title(content: str, fallback: str) -> str:
    first_line = content.strip().splitlines()[0] if content.strip() else ""
    if first_line.startswith("# "):
        return first_line[2:].strip()
    return fallback


def summarize_reference_source(entry: dict[str, Any]) -> dict[str, Any]:
    source_path = resolve_reference_root() / entry["file"]
    raw = source_path.read_text(encoding="utf-8", errors="ignore")
    archive_title = extract_markdown_title(raw, entry["materialLabel"])
    extracted_text = extract_archive_body(raw)
    return {
        **entry,
        "archiveTitle": archive_title,
        "charCount": len(extracted_text),
    }


def main() -> None:
    reference_root = resolve_reference_root()

    for directory in [
        KNOWLEDGE_ROOT / "canonical",
        KNOWLEDGE_ROOT / "prompts",
        KNOWLEDGE_ROOT / "skills",
        KNOWLEDGE_ROOT / "schemas",
    ]:
        directory.mkdir(parents=True, exist_ok=True)

    reference_sources = [summarize_reference_source(entry) for entry in SOURCE_FILES]

    for filename, content in CANONICAL_FILES.items():
        write_text(KNOWLEDGE_ROOT / "canonical" / filename, content)

    for filename, content in PROMPT_FILES.items():
        write_text(KNOWLEDGE_ROOT / "prompts" / filename, content)

    for filename, content in SKILL_FILES.items():
        write_text(KNOWLEDGE_ROOT / "skills" / filename, content)

    write_json(KNOWLEDGE_ROOT / "schemas" / "task-types.json", TASK_TYPES)
    write_json(KNOWLEDGE_ROOT / "schemas" / "context-priority.json", CONTEXT_PRIORITY)
    write_json(KNOWLEDGE_ROOT / "schemas" / "artifact-registry.json", ARTIFACT_REGISTRY)
    write_json(KNOWLEDGE_ROOT / "schemas" / "prompt-routing.json", PROMPT_ROUTING)
    write_json(KNOWLEDGE_ROOT / "schemas" / "skill-composition.json", SKILL_COMPOSITION)
    write_json(KNOWLEDGE_ROOT / "schemas" / "file-templates.json", FILE_TEMPLATES)
    write_json(KNOWLEDGE_ROOT / "schemas" / "source-extraction-policy.json", SOURCE_EXTRACTION_POLICY)
    write_json(KNOWLEDGE_ROOT / "schemas" / "editor-layout.json", EDITOR_LAYOUT)

    print("Generated knowledge assets:")
    print(f"- Source root: {reference_root}")
    print(f"- Canonical files: {len(CANONICAL_FILES)}")
    print(f"- Prompt files: {len(PROMPT_FILES)}")
    print(f"- Skill files: {len(SKILL_FILES)}")
    print("- Schema files: 8")
    print(f"- Reference sources: {len(reference_sources)}")


if __name__ == "__main__":
    main()

