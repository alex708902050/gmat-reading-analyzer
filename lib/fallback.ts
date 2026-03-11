import { AnalysisResult, QuestionItem, WordLookup } from './types';

const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

const toZhStub = (text: string) => `（需配置 OPENAI_API_KEY）${text}`;

const parseQuestions = (text: string): QuestionItem[] => {
  const blocks = text.split(/\n(?=\d+\.|Question\s+\d+)/i).filter((b) => /\?/.test(b));

  return blocks.slice(0, 8).map((block, idx) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const en = lines[0] ?? `Question ${idx + 1}`;
    const options = ['A', 'B', 'C', 'D', 'E'].map((label, optionIndex) => {
      const optionLine = lines.find((line) => new RegExp(`^${label}[.)\\s]`, 'i').test(line));
      const enOpt = optionLine ?? `${label}. Option ${optionIndex + 1}`;
      return {
        label: label as 'A' | 'B' | 'C' | 'D' | 'E',
        en: enOpt,
        zh: toZhStub(enOpt),
        isCorrect: optionIndex === 0,
        explanation: optionIndex === 0 ? '配置 key 后可生成真实解析。' : '配置 key 后可生成真实排除逻辑。'
      };
    });

    return {
      id: `q-${idx + 1}`,
      type: 'Unknown',
      en,
      zh: toZhStub(en),
      options,
      answer: 'A',
      whyCorrect: '尚未配置 OPENAI_API_KEY，暂无法生成可信答案解析。',
      whyWrong: '尚未配置 OPENAI_API_KEY，暂无法生成选项排除分析。'
    };
  });
};

export const fallbackAnalysis = (sourceText: string): AnalysisResult => {
  const paragraph = sourceText.split(/\n{2,}/).find((p) => p.trim().length > 80) ?? sourceText;
  const sentences = splitSentences(paragraph).map((en) => ({ en, zh: toZhStub(en) }));

  return {
    sourceText,
    article: {
      original: paragraph.trim(),
      sentences
    },
    logic: {
      mainIdea: '未配置 OPENAI_API_KEY，暂时无法进行真实逻辑分析。',
      structure: ['请在 Vercel 配置 OPENAI_API_KEY 后重新部署。'],
      argumentFlow: ['重新部署后可获得主旨、段落功能、论证关系与作者态度分析。'],
      authorTone: 'N/A'
    },
    questions: parseQuestions(sourceText),
    warnings: ['请在 Vercel 的 Environment Variables 添加 OPENAI_API_KEY，并 Redeploy。']
  };
};

export const fallbackWordLookup = (word: string): WordLookup => ({
  word,
  pos: 'n./v.',
  zh: `占位释义：${word}`
});
