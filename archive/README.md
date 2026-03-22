# Archive Library

`archive/reference-library/` 保存公开仓库允许保留的标准化 Markdown 来源稿。

约束：

- 应用运行时只允许读取 `knowledge/`，不得直接读取这里的来源稿。
- `scripts/generate_knowledge_assets.py` 会从这里重新生成 `knowledge/`。
- 公开仓库不再保留原始文件名、网页壳资源和附件目录。
- 运行时 prompt / skill / canonical 文件默认生成干净版本，不再内嵌来源追溯块。
