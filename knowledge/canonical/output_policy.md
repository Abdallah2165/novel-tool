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
