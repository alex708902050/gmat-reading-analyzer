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
  const missingReasoningFallback = 'This option explanation was not returned by the model.';

  return labels.map((label) => {
    const option = options.find((opt) => opt.label === label);

    return option
      ? {
          ...option,
          reasoning: option.reasoning?.trim() || missingReasoningFallback
        }
      : {
        label,
        en: `${label}. Missing option`,
        zh: `${label}. 选项缺失`,
        reasoning: '该选项在识别结果中缺失，请检查截图清晰度。'
      };
  });
};

const normalizeResult = (raw: AnalysisResult, sourceText: string): AnalysisResult => {
  const questions: QuestionItem[] = (raw.questions ?? []).map((q, idx) => ({
    id: q.id || `q-${idx + 1}`,
    type: q.type || inferQuestionType(q.en || ''),
    en: q.en || `Question ${idx + 1}`,
    zh: q.zh || '题干翻译缺失',
    options: normalizeOptions(q.options ?? []),
    answer: (q.answer || '').replace(/[^A-E]/gi, '').slice(0, 1).toUpperCase() || 'A'
  }));

  const paragraphs = raw.article?.paragraphs?.filter((p) => p.en?.trim()) ?? [];
  const fallbackSource = sourceText || raw.article?.original || '';

  return {
    sourceText: raw.sourceText || fallbackSource,
    article: {
      original: raw.article?.original || fallbackSource,
      paragraphs: paragraphs.length
        ? paragraphs
        : fallbackSource
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .slice(0, 6)
            .map((p) => ({ en: p, zh: '段落翻译缺失，请重试。' }))
    },
    logic: {
      mainIdea: raw.logic?.mainIdea || '主旨提取失败，请重试。',
      paragraphRoles: raw.logic?.paragraphRoles ?? [],
      paragraphLogic: raw.logic?.paragraphLogic ?? [],
      authorView: raw.logic?.authorView || '作者观点提取失败，请重试。',
      gmatTraps: raw.logic?.gmatTraps ?? []
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

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            '你是一名 GMAT 阅读老师。你需要直接基于图片做视觉识别并完成阅读分析，避免要求额外 OCR。只输出严格 JSON，不要输出 Markdown。所有逻辑分析与选项解释必须中文。'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                '请输出 JSON：{"sourceText":"","article":{"original":"","paragraphs":[{"en":"","zh":""}]},"logic":{"mainIdea":"","paragraphRoles":[""],"paragraphLogic":[""],"authorView":"","gmatTraps":[""]},"questions":[{"id":"q-1","type":"","en":"","zh":"","options":[{"label":"A","en":"","zh":"","reasoning":""}],"answer":"A"}],"warnings":[]}。要求：1) 段落级中英翻译；2) Question 的 A-E 每个选项都给中文 reasoning，说明为什么对或错；3) 若信息缺失请在 warnings 说明。'
            },
            ...images.map((img) => ({
              type: 'image_url' as const,
              image_url: { url: img.dataUrl }
            })),
            ...(body.text
              ? [
                  {
                    type: 'text' as const,
                    text: `补充文本：${body.text}`
                  }
                ]
              : [])
          ]
        }
      ]
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
