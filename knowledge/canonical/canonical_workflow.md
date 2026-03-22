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
