import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { fallbackAnalysis } from '@/lib/fallback';
import { AnalysisResult, OptionItem, QuestionItem } from '@/lib/types';

type InputImage = { name: string; type: string; dataUrl: string };

type AnalyzeRequest = {
  text?: string;
  images?: InputImage[];
};

type LightweightAnalyze = {
  sourceText?: string;
  questions?: Array<
    | {
        id?: string;
        type?: string;
        en?: string;
      }
    | string
  >;
  warnings?: string[];
};

type EnrichedAnalyze = {
  article?: {
    original?: string;
    paragraphs?: Array<{ en?: string; zh?: string }>;
  };
  logic?: {
    mainIdea?: string;
    paragraphRoles?: string[];
    paragraphLogic?: string[];
    authorView?: string;
    gmatTraps?: string[];
  };
  questions?: Array<Partial<QuestionItem>>;
  warnings?: string[];
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
  return labels.map((label) => {
    const option = options.find((opt) => opt.label === label);
    return (
      option ?? {
        label,
        en: `${label}. Missing option`,
        zh: `${label}. 选项缺失`,
        reasoning: '该选项在识别结果中缺失，请检查截图清晰度。'
      }
    );
  });
};

const parseDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return { base64: match[2] };
};

const getDataUrlSizeBytes = (dataUrl: string) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed?.base64) return 0;
  return Math.floor((parsed.base64.length * 3) / 4);
};

const tryCompressDataUrl = async (dataUrl: string) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return dataUrl;

  try {
    // eslint-disable-next-line no-eval
    const req = eval('require') as (name: string) => any;
    const sharpModule = req('sharp');
    const sharp = sharpModule?.default ?? sharpModule;
    if (!sharp) return dataUrl;

    const inputBuffer = Buffer.from(parsed.base64, 'base64');
    const outputBuffer: Buffer = await sharp(inputBuffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    return `data:image/jpeg;base64,${outputBuffer.toString('base64')}`;
  } catch {
    return dataUrl;
  }
};

const optimizeImagePayload = async (images: InputImage[]) => {
  const maxBytes = 800 * 1024;
  return Promise.all(
    images.map(async (img) => {
      if (getDataUrlSizeBytes(img.dataUrl) <= maxBytes) return img;
      const compressedDataUrl = await tryCompressDataUrl(img.dataUrl);
      return {
        ...img,
        type: 'image/jpeg',
        dataUrl: compressedDataUrl
      };
    })
  );
};

const getResponseText = (response: OpenAI.Responses.Response) => {
  if (response.output_text?.trim()) return response.output_text;

  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const chunk of item.content ?? []) {
      if (chunk.type === 'output_text' && chunk.text?.trim()) return chunk.text;
    }
  }

  return '';
};

async function analyzeImageWithAI(openai: OpenAI, images: InputImage[], text: string, signal: AbortSignal) {
  const optimizedImages = await optimizeImagePayload(images);

  const response = await openai.responses.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_output_tokens: 1200,
    text: { format: { type: 'json_object' } },
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: '你是 OCR 助手，只输出 JSON。' }]
      },
      {
        role: 'user',
        content: [
          { type: 'input_text', text: '提取为: {"sourceText":"","questions":[{"id":"q-1","en":""}],"warnings":[]}' },
          ...optimizedImages.map((img) => ({
            type: 'input_image' as const,
            image_url: img.dataUrl,
            detail: 'low' as const
          })),
          ...(text ? [{ type: 'input_text' as const, text: `补充文本：${text}` }] : [])
        ]
      }
    ]
  }, { signal });

  return JSON.parse(getResponseText(response) || '{}') as LightweightAnalyze;
}

async function enrichTextWithAI(openai: OpenAI, sourceText: string, signal: AbortSignal) {
  const response = await openai.responses.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_output_tokens: 2200,
    text: { format: { type: 'json_object' } },
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: '你是 GMAT 阅读老师，只输出 JSON。' }]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              '基于文本输出: {"article":{"original":"","paragraphs":[{"en":"","zh":""}]},"logic":{"mainIdea":"","paragraphRoles":[],"paragraphLogic":[],"authorView":"","gmatTraps":[]},"questions":[],"warnings":[]}。文本如下：\n' +
              sourceText
          }
        ]
      }
    ]
  }, { signal });

  return JSON.parse(getResponseText(response) || '{}') as EnrichedAnalyze;
}

const normalizeResult = (raw: AnalysisResult, sourceText: string): AnalysisResult => {
  const questions: QuestionItem[] = (raw.questions ?? []).map((q, idx) => {
    const current: Partial<QuestionItem> = typeof q === 'string' ? { en: q } : q;
    return {
      id: current.id || `q-${idx + 1}`,
      type: current.type || inferQuestionType(current.en || ''),
      en: current.en || `Question ${idx + 1}`,
      zh: current.zh || '题干翻译缺失',
      options: normalizeOptions(current.options ?? []),
      answer: (current.answer || '').replace(/[^A-E]/gi, '').slice(0, 1).toUpperCase() || 'A'
    };
  });

  const paragraphFallbackSource = sourceText || raw.article?.original || '';
  const paragraphs = raw.article?.paragraphs?.filter((p) => p.en?.trim()) ?? [];

  return {
    sourceText: raw.sourceText || paragraphFallbackSource,
    article: {
      original: raw.article?.original || paragraphFallbackSource,
      paragraphs: paragraphs.length
        ? paragraphs.map((p) => ({
            en: p.en?.trim() || '',
            zh: p.zh?.trim() || '段落翻译缺失，请重试。'
          }))
        : paragraphFallbackSource
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
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

  const fallback = fallbackAnalysis(body.text ?? '');

  try {
    const openai = new OpenAI({ apiKey });

    const stage1Controller = new AbortController();
    const stage1Timer = setTimeout(() => stage1Controller.abort(), 20_000);

    let parsed: LightweightAnalyze;
    try {
      parsed = await analyzeImageWithAI(openai, images, body.text ?? '', stage1Controller.signal);
    } finally {
      clearTimeout(stage1Timer);
    }

    const stage1Source = parsed.sourceText || body.text || '';

    let enriched: EnrichedAnalyze = {};
    if (stage1Source) {
      const stage2Controller = new AbortController();
      const stage2Timer = setTimeout(() => stage2Controller.abort(), 12_000);
      try {
        enriched = await enrichTextWithAI(openai, stage1Source, stage2Controller.signal);
      } catch {
        enriched = {};
      } finally {
        clearTimeout(stage2Timer);
      }
    }

    const normalized = normalizeResult(
      {
        sourceText: stage1Source,
        article: {
          original: enriched.article?.original || stage1Source,
          paragraphs: (enriched.article?.paragraphs ?? []).map((p) => ({ en: p.en || '', zh: p.zh || '' }))
        },
        logic: {
          mainIdea: enriched.logic?.mainIdea || '',
          paragraphRoles: enriched.logic?.paragraphRoles ?? [],
          paragraphLogic: enriched.logic?.paragraphLogic ?? [],
          authorView: enriched.logic?.authorView || '',
          gmatTraps: enriched.logic?.gmatTraps ?? []
        },
        questions: (enriched.questions?.length ? enriched.questions : parsed.questions ?? []) as QuestionItem[],
        warnings: [...(parsed.warnings ?? []), ...(enriched.warnings ?? [])]
      },
      stage1Source
    );

    if (!normalized.questions.length && normalized.sourceText) {
      const questionHints = extractQuestionCandidates(normalized.sourceText);
      normalized.warnings = [...(normalized.warnings ?? []), `已识别题干线索 ${questionHints.length} 条，请检查截图清晰度。`];
    }

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Analyze fallback:', error);
    const timeoutText = error instanceof Error && error.name === 'AbortError'
      ? 'OpenAI 调用超时（20 秒），已返回本地兜底结果。'
      : 'OpenAI 调用失败，请检查 key、额度或图片内容后重试。';

    return NextResponse.json(
      {
        ...fallback,
        warnings: [...(fallback.warnings ?? []), timeoutText]
      },
      { status: 200 }
    );
  }
}
