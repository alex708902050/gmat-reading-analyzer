import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { fallbackAnalysis } from '@/lib/fallback';
import { AnalysisResult } from '@/lib/types';

export async function POST(req: Request) {
  const { text } = await req.json();
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Missing OCR text' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(fallbackAnalysis(text));
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
            'You are a GMAT reading assistant. Extract article + questions and return strict JSON with keys: sourceText, article{original,sentences[{en,zh}]}, logic{mainIdea,structure[],argumentFlow[]}, questions[{id,en,zh,options[{label,en,zh,isCorrect,explanation}],answer,whyCorrect,whyWrong}]'
        },
        {
          role: 'user',
          content: text
        }
      ]
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as AnalysisResult;
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Analyze fallback:', error);
    return NextResponse.json(fallbackAnalysis(text));
  }
}
