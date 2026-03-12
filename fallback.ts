import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { fallbackWordLookup } from '@/lib/fallback';
import { WordLookup } from '@/lib/types';

export async function POST(req: Request) {
  const { word } = await req.json();
  if (!word || typeof word !== 'string') {
    return NextResponse.json({ error: 'Missing word' }, { status: 400 });
  }

  const normalized = word.trim();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(fallbackWordLookup(normalized));
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Output strict JSON: {"word":"","pos":"","zh":""}. POS should be concise.'
        },
        {
          role: 'user',
          content: normalized
        }
      ]
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as WordLookup;
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Lookup fallback:', error);
    return NextResponse.json(fallbackWordLookup(normalized));
  }
}
