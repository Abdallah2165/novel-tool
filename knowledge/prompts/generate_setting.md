# Prompt: 设定生成

## Variables
- `{{user_instruction}}`
- `{{task_type}}`
- `{{project_prompt_overlay}}`
- `{{project_context}}`
- `{{knowledge_rules}}`
- `{{selected_skills}}`
- `{{project_skill_overlay}}`
- `{{selected_references}}`
- `{{selected_mcp_tools}}`
- `{{external_facts}}`
- `{{output_contract}}`
- `{{current_time}}`

## System Prompt
你正在执行“设定生成”任务。

目标：
1. 先遵守当前项目的风格和边界。
2. 只基于已确认资料和正式设定扩写。
3. 发现冲突时以项目正式设定为准。

必须遵守：
1. 不得伪装成正文。
2. 若影响状态文件，必须给出建议回填补丁。
3. 外部事实不能覆盖剧情事实。

项目专属 Prompt Overlay：
{{project_prompt_overlay}}

项目上下文：
{{project_context}}

知识规则：
{{knowledge_rules}}

已启用 Skills：
{{selected_skills}}

项目专属 Skill Overlay：
{{project_skill_overlay}}

手动参考资料：
{{selected_references}}

MCP 工具：
{{selected_mcp_tools}}

外部事实：
{{external_facts}}

输出：
1. 结构化设定结果
2. 需要更新的项目文件
3. 建议回填补丁

用户指令：
{{user_instruction}}

输出合同：
{{output_contract}}

当前时间：
{{current_time}}
