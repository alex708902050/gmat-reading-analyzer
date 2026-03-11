# GMAT Reading Analyzer (Next.js MVP)

一个可部署到 Vercel 的云端网页工具：支持上传多张 GMAT 阅读截图，OCR 提取文字，生成文章与题目解析，并提供右侧单词笔记表（去重、导出 Excel、清空）。

## 1. 功能概览

- 多图上传（同一批次可包含文章+题目截图）。
- OCR 识别：使用 `tesseract.js` 在前端识别英文文本。
- 分析结果（左侧）：
  - 文章原文
  - 句子拆分 + 英中对照
  - 主旨、段落结构、论证逻辑
  - 题干英中、ABCD(E) 选项英中
  - 正确答案 + 对错解析
- 单词笔记（右侧）：
  - 在左侧拖动选择单词/词组后弹窗释义
  - 点击“记录到笔记”写入表格
  - 自动大小写无关去重提示
  - 导出 Excel
  - 一键清空
- 上传新截图时：
  - 左侧分析结果重置并重新生成
  - 右侧笔记保留不变

## 2. 项目结构

```text
.
├─ app/
│  ├─ api/
│  │  ├─ analyze/route.ts      # 分析 API（优先调用 OpenAI，无 key 则回退）
│  │  └─ lookup/route.ts       # 单词释义 API（优先调用 OpenAI，无 key 则回退）
│  ├─ globals.css              # 全局样式（左右分栏 + 表格 + 浮窗）
│  ├─ layout.tsx               # 根布局
│  └─ page.tsx                 # 核心页面（上传、OCR、分析渲染、词汇选择）
├─ components/
│  └─ WordNotesTable.tsx       # 词汇笔记表格（导出 Excel / 清空）
├─ lib/
│  ├─ fallback.ts              # 无模型时的占位分析与释义逻辑
│  └─ types.ts                 # 类型定义
├─ package.json
├─ next.config.mjs
└─ tsconfig.json
```

## 3. 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 4. 环境变量（可选）

如果希望得到更好的中译和题目解析，可配置：

```bash
OPENAI_API_KEY=your_key_here
```

> 未配置时系统会自动使用 fallback 占位逻辑，MVP 仍可运行。

## 5. 部署到 Vercel

1. 将仓库推送到 GitHub。
2. 登录 Vercel，导入该仓库。
3. Framework 选择 Next.js（自动识别）。
4. 在 Vercel Project Settings → Environment Variables 添加：
   - `OPENAI_API_KEY`（可选）
5. 点击 Deploy。

## 6. MVP 说明与后续可扩展

当前版本重点实现了完整工作流与交互骨架。后续建议：

- OCR 后做版面重排（识别题干/选项区域）。
- 增加用户体系与云端笔记持久化。
- 增加句子级高亮与词频统计。
- 将 fallback 翻译替换为专业翻译引擎。
