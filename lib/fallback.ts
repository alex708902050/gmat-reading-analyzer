import { AnalysisResult, QuestionItem, WordLookup } from './types';

const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

const toZhStub = (text: string) => `（机翻占位）${text}`;

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
        explanation: optionIndex === 0 ? '占位：该项与文章主旨最匹配。' : '占位：该项与题干要求不一致或偏离原文。'
      };
    });

    return {
      id: `q-${idx + 1}`,
      en,
      zh: toZhStub(en),
      options,
      answer: 'A',
      whyCorrect: '占位：A 与文章核心观点一致。',
      whyWrong: '占位：其余选项存在以偏概全、无中生有或偷换概念问题。'
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
      mainIdea: '占位：作者讨论一个核心议题，并通过例证支持观点。',
      structure: [
        '段落 1：提出背景与问题。',
        '段落 2：给出作者观点与关键证据。',
        '段落 3：总结影响或结论。'
      ],
      argumentFlow: [
        '提出现象 → 引出争议',
        '对比观点 → 给出立场',
        '依据证据 → 得出结论'
      ]
    },
    questions: parseQuestions(sourceText)
  };
};

export const fallbackWordLookup = (word: string): WordLookup => ({
  word,
  pos: 'n./v.',
  zh: `占位释义：${word}`
});
