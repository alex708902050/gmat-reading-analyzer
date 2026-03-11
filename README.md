# GMAT Reading Analyzer

一个可部署到 Vercel 的 GMAT 阅读分析网页工具：支持粘贴/拖拽/上传多张截图，服务端调用 OpenAI 完成 OCR + 阅读逻辑分析 + 题目选项解析，并提供可检索、可导出的单词笔记侧栏。

## 功能亮点

- **聊天式上传体验**：
  - `Ctrl + V` 直接粘贴截图
  - 拖拽图片到输入区
  - 点击上传作为备用
  - 支持一次多图，并显示缩略图预览
- **服务端 OpenAI 分析（不暴露 API key）**：
  - `/api/analyze` 接收图片
  - 模型执行 OCR 并提取文章/题目/选项
  - 返回结构化 JSON（文章、句子翻译、逻辑分析、题目、选项、答案解析）
- **GMAT 常见题干模式识别增强**：
  - primary purpose
  - main idea
  - inference
  - according to the passage
  - the author suggests
  - the passage implies
  - it can be inferred that
- **选项识别增强**：支持 A/B/C/D/E 标记与归一化。
- **右侧单词笔记**：
  - 表格累计
  - 搜索
  - 去重提醒（可查看原笔记或仍然添加）
  - 导出 Excel
  - 一键清空

## 快速开始

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 环境变量配置（必须）

项目需要在服务端读取：

```bash
OPENAI_API_KEY=your_key_here
```

> 未配置时，页面会明确提示你去 Vercel 添加 `OPENAI_API_KEY`，并且会提醒你重新部署，不再仅显示“机翻占位”。

## 在 Vercel 配置 OPENAI_API_KEY

1. 登录 Vercel 并导入该仓库。
2. 打开项目：`Settings -> Environment Variables`。
3. 新增：
   - Key: `OPENAI_API_KEY`
   - Value: 你的 OpenAI Key
4. 保存后执行 **Redeploy**（必须）。

> 仅添加环境变量不会自动让旧构建生效，必须重新部署。

## 使用流程

1. 在首页上传区粘贴、拖拽或点击添加图片（可多张）。
2. 确认缩略图后点击 `Analyze`。
3. 左侧查看分卡片分析结果：
   - Article
   - Sentence Translation
   - Logic Analysis
   - Questions
   - Options
   - Answer Explanation
4. 在左侧选择单词触发释义浮层，加入右侧笔记。
5. 右侧可搜索、导出 Excel、清空。

## 部署说明

- 框架：Next.js 14
- 运行环境：Node.js（Vercel 默认可用）
- API key 仅在服务端读取，不在前端暴露
