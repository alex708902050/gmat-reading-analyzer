import { AnalysisResult, QuestionItem, WordLookup } from './types';

const toZhStub = (text: string) => `（需配置 OPENAI_API_KEY）${text}`;

const splitParagraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);

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
        reasoning:
          optionIndex === 0
            ? '未配置 OPENAI_API_KEY，暂无法判断正确性，请配置后重试。'
            : '未配置 OPENAI_API_KEY，暂无法提供可靠排除理由。'
      };
    });

    return {
      id: `q-${idx + 1}`,
      type: 'Unknown',
      en,
      zh: toZhStub(en),
      options,
      answer: 'A'
    };
  });
};

export const fallbackAnalysis = (sourceText: string): AnalysisResult => {
  const paragraphs = splitParagraphs(sourceText);

  return {
    sourceText,
    article: {
      original: sourceText,
      paragraphs: (paragraphs.length ? paragraphs : [sourceText || '']).map((en) => ({ en, zh: toZhStub(en) }))
    },
    logic: {
      mainIdea: '未配置 OPENAI_API_KEY，暂时无法进行真实逻辑分析。',
      paragraphRoles: ['请在 Vercel 配置 OPENAI_API_KEY 后重新部署。'],
      paragraphLogic: ['重新部署后可获得段落衔接、作者观点与考点分析。'],
      authorView: '未配置 OPENAI_API_KEY，暂无法判断作者观点。',
      gmatTraps: ['未配置 OPENAI_API_KEY，暂无法生成高质量 GMAT 题型分析。']
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
