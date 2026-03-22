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
