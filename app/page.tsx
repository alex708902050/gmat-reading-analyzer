'use client';

import { useRef, useState } from 'react';
import { AnalysisResult, WordLookup } from '@/lib/types';
import { WordNotesTable, type NoteRow } from '@/components/WordNotesTable';

type UploadImage = {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
};

type PopoverState = {
  word: string;
  pos: string;
  zh: string;
  sentence: string;
  x: number;
  y: number;
} | null;

type DuplicateState = {
  next: NoteRow;
  existing: NoteRow;
} | null;

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const compressImage = async (file: File): Promise<UploadImage> => {
  const dataUrl = await toDataUrl(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const maxWidth = 1400;
  const ratio = Math.min(1, maxWidth / image.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * ratio);
  canvas.height = Math.round(image.height * ratio);
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);

  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    type: file.type || 'image/jpeg',
    dataUrl: canvas.toDataURL('image/jpeg', 0.84)
  };
};

const getSnippetWithWord = (word: string, sourceText: string, fallbackText: string) => {
  const normalizedWord = word.trim();
  if (!normalizedWord) return fallbackText;

  const normalizeToken = (token: string) => token.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '').toLowerCase();

  const findSentenceWithWord = (block: string) => {
    const sentences = block
      .split('.')
      .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const lower = normalizedWord.toLowerCase();
    return sentences.find((sentence) =>
      sentence
        .split(' ')
        .filter(Boolean)
        .some((token) => normalizeToken(token) === lower)
    );
  };

  const blocks = [sourceText, fallbackText].filter(Boolean);
  for (const block of blocks) {
    const matchedSentence = findSentenceWithWord(block);
    if (!matchedSentence) continue;

    const words = matchedSentence.split(' ').filter(Boolean);
    const lower = normalizedWord.toLowerCase();
    const idx = words.findIndex((token) => normalizeToken(token) === lower);
    if (idx < 0) continue;

    if (words.length <= 5) {
      return matchedSentence;
    }

    if (words.length <= 10) {
      return `... ${matchedSentence} ...`;
    }

    const minWords = 5;
    const maxWords = 10;
    const remaining = maxWords - 1;
    const leftCount = Math.floor(remaining / 2);
    const rightCount = remaining - leftCount;

    let start = Math.max(0, idx - leftCount);
    let end = Math.min(words.length, idx + rightCount + 1);

    while (end - start < minWords && (start > 0 || end < words.length)) {
      if (start > 0) start -= 1;
      if (end - start < minWords && end < words.length) end += 1;
    }

    if (end - start < maxWords) {
      if (start === 0) {
        end = Math.min(words.length, maxWords);
      } else if (end === words.length) {
        start = Math.max(0, words.length - maxWords);
      }
    }

    const snippet = words.slice(start, end).join(' ');
    return `... ${snippet} ...`;
  }

  return `... ${normalizedWord} ...`;
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [popover, setPopover] = useState<PopoverState>(null);
  const [message, setMessage] = useState('Add images and click Analyze.');
  const [images, setImages] = useState<UploadImage[]>([]);
  const [duplicateState, setDuplicateState] = useState<DuplicateState>(null);
  const [highlightedWord, setHighlightedWord] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!arr.length) return;
    const normalized = await Promise.all(arr.map(compressImage));
    setImages(normalized);
    setAnalysis(null);
    setPopover(null);
    setMessage(`已添加 ${normalized.length} 张图片，点击 Analyze 开始分析。`);
  };

  const onAnalyze = async () => {
    if (!images.length) {
      setMessage('请先添加至少一张图片。');
      return;
    }

    setLoading(true);
    setAnalysis(null);
    setMessage('正在进行视觉识别与阅读分析，请稍候...');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images })
      });
      const data = (await res.json()) as AnalysisResult;
      setAnalysis(data);

      if (data.warnings?.length) {
        setMessage(data.warnings.join('；'));
      } else {
        setMessage('');
      }
    } catch (error) {
      console.error(error);
      setMessage('分析失败，请检查网络、图片清晰度与 API 配置。');
    } finally {
      setLoading(false);
    }
  };

  const onTextMouseUp = async () => {
    const selection = window.getSelection()?.toString().trim();
    if (!selection || selection.split(/\s+/).length > 4) return;

    const range = window.getSelection()?.getRangeAt(0);
    if (!range) return;

    const rect = range.getBoundingClientRect();
    const localText = range.startContainer.textContent?.trim() ?? '';
    const sentence = getSnippetWithWord(selection, analysis?.sourceText ?? '', localText);

    const res = await fetch('/api/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: selection })
    });

    const data = (await res.json()) as WordLookup;
    setPopover({
      word: data.word,
      pos: data.pos,
      zh: data.zh,
      sentence,
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY + 8
    });
  };

  const addNote = (force = false) => {
    if (!popover) return;

    const next: NoteRow = { word: popover.word, pos: popover.pos, zh: popover.zh, sentence: popover.sentence };
    const existing = notes.find((n) => n.word.toLowerCase() === next.word.toLowerCase());

    if (existing && !force) {
      setDuplicateState({ next, existing });
      return;
    }

    setNotes((prev) => [...prev, next]);
    setHighlightedWord(next.word);
    setPopover(null);
    setDuplicateState(null);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>AUTO ANALYSIS</h1>
      </header>

      <div className="layout">
        <section className="left-panel" onMouseUp={onTextMouseUp}>
          <p className="hint">{message}</p>

          {!analysis && !loading && (
            <div className="empty-state">
              <h3>♡</h3>
            </div>
          )}

          {loading && <div className="loading-card">正在识别图片文本并生成结构化分析...</div>}

          {analysis && (
            <div className="result-grid">
              <article className="card compact">
                <h3>Passage Translation</h3>
                <div className="paragraph-list">
                  {analysis.article.paragraphs.map((paragraph, idx) => (
                    <section key={idx} className="paragraph-item">
                      <p>{paragraph.en}</p>
                      <p className="zh">{paragraph.zh}</p>
                    </section>
                  ))}
                </div>
              </article>

              <article className="card compact">
                <h3>Passage Logic</h3>
                <div className="logic-block">
                  <p><strong>文章主旨：</strong>{analysis.logic.mainIdea}</p>
                  <p><strong>作者观点：</strong>{analysis.logic.authorView}</p>
                  <div>
                    <strong>每段作用：</strong>
                    <ul>{analysis.logic.paragraphRoles.map((x, idx) => <li key={idx}>{x}</li>)}</ul>
                  </div>
                  <div>
                    <strong>段落之间逻辑：</strong>
                    <ul>{analysis.logic.paragraphLogic.map((x, idx) => <li key={idx}>{x}</li>)}</ul>
                  </div>
                  <div>
                    <strong>GMAT 常考题型：</strong>
                    <ul>{analysis.logic.gmatTraps.map((x, idx) => <li key={idx}>{x}</li>)}</ul>
                  </div>
                </div>
              </article>

              <article className="card compact">
                <h3>Question Analysis</h3>
                {analysis.questions.map((q) => (
                  <div key={q.id} className="question-card">
                    <p><strong>题型：</strong>{q.type}</p>
                    <p><strong>题干（英文）：</strong>{q.en}</p>
                    <p><strong>题干（中文）：</strong>{q.zh}</p>
                    <p><strong>正确答案：</strong>{q.answer}</p>
                    <div className="option-stack">
                      {q.options.map((o) => (
                        <div key={o.label} className="option-row">
                          <p><strong>{o.label}. 英文：</strong>{o.en}</p>
                          <p><strong>{o.label}. 中文：</strong>{o.zh}</p>
                          <p><strong>{o.label}. 解析：</strong>{o.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </article>
            </div>
          )}
        </section>

        <aside className="right-panel">
          <WordNotesTable notes={notes} onClear={() => setNotes([])} highlightedWord={highlightedWord} />
          <div
            className={`composer ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void addFiles(e.dataTransfer.files);
            }}
            onPaste={(e) => {
              void addFiles(e.clipboardData.files);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
              }}
            />
            <div className="composer-actions">
              <button onClick={() => fileInputRef.current?.click()}>Add</button>
              <button className="solid" onClick={onAnalyze} disabled={loading || images.length === 0}>
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
            {images.length > 0 && (
              <div className="thumb-list">
                {images.map((img) => (
                  <figure key={img.id} className="thumb-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.dataUrl} alt={img.name} />
                    <figcaption>{img.name}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {popover && (
        <div className="popover" style={{ left: popover.x, top: popover.y }}>
          <p className="word">{popover.word}</p>
          <p>词性：{popover.pos}</p>
          <p>中文：{popover.zh}</p>
          <button className="save" onClick={() => addNote()}>❤️ 保存</button>
        </div>
      )}

      {duplicateState && (
        <div className="duplicate-modal">
          <div className="duplicate-card">
            <h4>该词已存在</h4>
            <p>已记录：{duplicateState.existing.word}（{duplicateState.existing.zh}）</p>
            <div className="composer-actions">
              <button
                onClick={() => {
                  setHighlightedWord(duplicateState.existing.word);
                  setDuplicateState(null);
                }}
              >
                查看原笔记
              </button>
              <button className="solid" onClick={() => addNote(true)}>仍然添加</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
