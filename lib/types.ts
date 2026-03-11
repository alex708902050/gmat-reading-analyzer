export type BilingualSentence = {
  en: string;
  zh: string;
};

export type OptionItem = {
  label: 'A' | 'B' | 'C' | 'D' | 'E';
  en: string;
  zh: string;
  isCorrect?: boolean;
  explanation?: string;
};

export type QuestionItem = {
  id: string;
  type: string;
  en: string;
  zh: string;
  options: OptionItem[];
  answer: string;
  whyCorrect: string;
  whyWrong: string;
};

export type AnalysisResult = {
  sourceText: string;
  article: {
    original: string;
    sentences: BilingualSentence[];
  };
  logic: {
    mainIdea: string;
    structure: string[];
    argumentFlow: string[];
    authorTone: string;
  };
  questions: QuestionItem[];
  warnings?: string[];
};

export type WordLookup = {
  word: string;
  pos: string;
  zh: string;
};
