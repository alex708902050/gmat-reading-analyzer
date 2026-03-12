# AUTO ANALYSIS

一个可部署到 Vercel 的 GMAT 阅读分析网页工具：支持截图粘贴、拖拽、点击上传多张图片；服务端使用 OpenAI 直接进行图片视觉识别与阅读分析；并提供右侧 Word Notes 笔记侧栏。

## 功能亮点

- **固定模型：`gpt-4o-mini`**
  - `/api/analyze` 与 `/api/lookup` 均显式使用 `model: "gpt-4o-mini"`
  - 降低成本并提升响应速度
- **图片输入完整支持**
  - `Ctrl + V` 粘贴截图
  - 拖拽上传
  - 点击上传
  - 支持多张图片同时分析
- **分析结果更贴近 GMAT 实战**
  - Passage Translation（按段落中英对照）
  - Passage Logic（全中文：主旨、段落作用、逻辑衔接、作者观点、常考题型）
  - Question Analysis（题干双语 + A-E 选项双语 + 每项中文讲解）
- **Word Notes 侧栏**
  - 搜索
  - 导出 Excel
  - 清空
  - 单词悬浮保存（❤️）

## 快速开始

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 环境变量（必须）

项目需要在服务端读取：

```bash
OPENAI_API_KEY=your_key_here
```

> 未配置时，系统会返回降级提示与占位分析内容。

## 使用流程

1. 通过粘贴 / 拖拽 / 点击方式上传一张或多张截图。
2. 点击 `Analyze`，服务端使用 `gpt-4o-mini` 完成识别与分析。
3. 左侧查看段落翻译、逻辑分析和题目解析。
4. 在左侧选中单词，悬浮窗显示词性和中文，点击 ❤️ 保存到右侧笔记。
5. 右侧可搜索、导出 Excel、清空。

## 技术栈

- Next.js 14
- OpenAI Node SDK
- xlsx
test deploy
