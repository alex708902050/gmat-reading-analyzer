import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { fallbackAnalysis } from '@/lib/fallback';
import { AnalysisResult, OptionItem, QuestionItem } from '@/lib/types';

type InputImage = { name: string; type: string; dataUrl: string };

type AnalyzeRequest = {
  text?: string;
  images?: InputImage[];
};

const QUESTION_PATTERNS = [
  'primary purpose',
  'main idea',
  'inference',
  'according to the passage',
  'the author suggests',
  'the passage implies',
  'it can be inferred that'
];

const QUESTION_TYPE_MAP: Record<string, string> = {
  'primary purpose': 'Primary Purpose',
  'main idea': 'Main Idea',
  inference: 'Inference',
  'according to the passage': 'Detail',
  'the author suggests': 'Author Suggests',
  'the passage implies': 'Implication',
  'it can be inferred that': 'Inference'
};

const inferQuestionType = (questionText: string) => {
  const normalized = questionText.toLowerCase();
  for (const pattern of QUESTION_PATTERNS) {
    if (normalized.includes(pattern)) return QUESTION_TYPE_MAP[pattern];
  }
  return 'Other';
};

const normalizeOptions = (options: OptionItem[]) => {
  const labels: OptionItem['label'][] = ['A', 'B', 'C', 'D', 'E'];
  const normalized = labels
    .map((label) => options.find((opt) => opt.label === label) ?? null)
    .filter(Boolean) as OptionItem[];

  if (normalized.length >= 4) return normalized;
  return labels.map((label) => normalized.find((opt) => opt.label === label) ?? {
    label,
    en: `${label}. Missing option`,
    zh: `${label}. 选项缺失`
  });
};

const normalizeResult = (raw: AnalysisResult, sourceText: string): AnalysisResult => {
  const questions: QuestionItem[] = (raw.questions ?? []).map((q, idx) => ({
    ...q,
    id: q.id || `q-${idx + 1}`,
    type: q.type || inferQuestionType(q.en || ''),
    options: normalizeOptions(q.options ?? []),
    answer: (q.answer || '').replace(/[^A-E]/gi, '').slice(0, 1).toUpperCase() || 'A',
    whyCorrect: q.whyCorrect || 'No explanation provided.',
    whyWrong: q.whyWrong || 'No elimination notes provided.'
  }));

  return {
    sourceText: raw.sourceText || sourceText,
    article: {
      original: raw.article?.original || sourceText,
      sentences: raw.article?.sentences?.length ? raw.article.sentences : []
    },
    logic: {
      mainIdea: raw.logic?.mainIdea || 'N/A',
      structure: raw.logic?.structure || [],
      argumentFlow: raw.logic?.argumentFlow || [],
      authorTone: raw.logic?.authorTone || 'N/A'
    },
    questions,
    warnings: raw.warnings || []
  };
};

const extractQuestionCandidates = (text: string) => {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.filter((line) => QUESTION_PATTERNS.some((pattern) => line.toLowerCase().includes(pattern)));
};

export async function POST(req: Request) {
  const body = (await req.json()) as AnalyzeRequest;
  const images = body.images ?? [];

  if (!images.length && (!body.text || typeof body.text !== 'string')) {
    return NextResponse.json({ error: 'Missing image payload' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ...fallbackAnalysis(body.text ?? ''),
        warnings: ['未检测到 OPENAI_API_KEY。请在 Vercel > Settings > Environment Variables 添加后重新部署。']
      },
      { status: 200 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const input = [
      {
        role: 'system' as const,
        content:
          'You are a GMAT Reading expert. First perform OCR from provided images. Then extract passage, question stems, and options. Return strict JSON only. Ensure options are labeled A-E. Recognize common stem patterns: primary purpose, main idea, inference, according to the passage, the author suggests, the passage implies, it can be inferred that.'
      },
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text:
              'Output JSON schema: {"sourceText":"", "article":{"original":"", "sentences":[{"en":"","zh":""}]}, "logic":{"mainIdea":"", "structure":[""], "argumentFlow":[""], "authorTone":""}, "questions":[{"id":"q-1","type":"","en":"","zh":"","options":[{"label":"A","en":"","zh":"","isCorrect":false,"explanation":""}],"answer":"A","whyCorrect":"","whyWrong":""}], "warnings":[]}. Translate every sentence and every option into Chinese.'
          },
          ...images.map((img) => ({
            type: 'image_url' as const,
            image_url: {
              url: img.dataUrl
            }
          })),
          ...(body.text
            ? [
                {
                  type: 'text' as const,
                  text: `Supplemental OCR text: ${body.text}`
                }
              ]
            : [])
        ]
      }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: input
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as AnalysisResult;
    const normalized = normalizeResult(parsed, body.text ?? parsed.sourceText ?? '');

    if (!normalized.questions.length && normalized.sourceText) {
      const questionHints = extractQuestionCandidates(normalized.sourceText);
      normalized.warnings = [...(normalized.warnings ?? []), `已识别题干线索 ${questionHints.length} 条，请检查截图清晰度。`];
    }

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Analyze fallback:', error);
    return NextResponse.json(
      {
        ...fallbackAnalysis(body.text ?? ''),
        warnings: ['OpenAI 调用失败，请检查 key、额度或图片内容后重试。']
      },
      { status: 200 }
    );
  }
}
