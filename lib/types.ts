export type BilingualParagraph = {
  en: string;
  zh: string;
};

export type OptionItem = {
  label: 'A' | 'B' | 'C' | 'D' | 'E';
  en: string;
  zh: string;
  reasoning: string;
};

export type QuestionItem = {
  id: string;
  type: string;
  en: string;
  zh: string;
  options: OptionItem[];
  answer: string;
};

export type AnalysisResult = {
  sourceText: string;
  article: {
    original: string;
    paragraphs: BilingualParagraph[];
  };
  logic: {
    mainIdea: string;
    paragraphRoles: string[];
    paragraphLogic: string[];
    authorView: string;
    gmatTraps: string[];
  };
  questions: QuestionItem[];
  warnings?: string[];
};

export type WordLookup = {
  word: string;
  pos: string;
  zh: string;
};
