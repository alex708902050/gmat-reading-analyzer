'use client';

import { useMemo, useRef, useState } from 'react';
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

  const maxWidth = 1600;
  const ratio = Math.min(1, maxWidth / image.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * ratio);
  canvas.height = Math.round(image.height * ratio);
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);

  const compressed = canvas.toDataURL('image/jpeg', 0.88);
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    type: file.type || 'image/jpeg',
    dataUrl: compressed
  };
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [popover, setPopover] = useState<PopoverState>(null);
  const [message, setMessage] = useState('粘贴截图、拖拽图片或点击上传后，点击 Analyze 开始。');
  const [images, setImages] = useState<UploadImage[]>([]);
  const [duplicateState, setDuplicateState] = useState<DuplicateState>(null);
  const [highlightedWord, setHighlightedWord] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!arr.length) return;
    const normalized = await Promise.all(arr.map(compressImage));
    setImages((prev) => [...prev, ...normalized]);
    setAnalysis(null);
    setMessage(`已添加 ${normalized.length} 张图片，点击 Analyze 开始分析。`);
  };

  const onAnalyze = async () => {
    if (!images.length) {
      setMessage('请先添加至少一张图片。');
      return;
    }

    setLoading(true);
    setAnalysis(null);
    setMessage('正在进行 OCR 与 OpenAI 分析，请稍候...');

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
        setMessage('分析完成。上传新图片会清空左侧分析，右侧笔记保留。');
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
    const sentence = (range.startContainer.textContent ?? '').slice(0, 80);

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
      y: rect.bottom + window.scrollY + 10
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

  const stats = useMemo(
    () => ({
      sentenceCount: analysis?.article.sentences.length ?? 0,
      questionCount: analysis?.questions.length ?? 0
    }),
    [analysis]
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>GMAT Reading Analyzer</h1>
          <p>OCR + OpenAI 深度阅读分析，适配 GMAT 真题训练流程。</p>
        </div>
      </header>

      <div className="layout">
        <section className="left-panel" onMouseUp={onTextMouseUp}>
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
            <p>支持 Ctrl+V 粘贴截图 / 拖拽上传 / 点击添加图片</p>
            <div className="composer-actions">
              <button onClick={() => fileInputRef.current?.click()}>添加图片</button>
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

          <p className="hint">{message}</p>

          {!analysis && !loading && (
            <div className="empty-state">
              <h3>准备开始一轮高质量阅读分析</h3>
              <p>上传文章与题目截图后，将自动生成双语句子、逻辑结构、题目类型与选项解析。</p>
            </div>
          )}

          {loading && <div className="loading-card">正在识别图片文本并生成结构化分析...</div>}

          {analysis && (
            <div className="result-grid">
              <article className="card">
                <h3>Article</h3>
                <pre>{analysis.article.original}</pre>
              </article>

              <article className="card">
                <h3>Sentence Translation ({stats.sentenceCount})</h3>
                {analysis.article.sentences.map((s, idx) => (
                  <div key={idx} className="sentence-row">
                    <p><strong>EN</strong> {s.en}</p>
                    <p><strong>ZH</strong> {s.zh}</p>
                  </div>
                ))}
              </article>

              <article className="card">
                <h3>Logic Analysis</h3>
                <p><strong>Main Idea:</strong> {analysis.logic.mainIdea}</p>
                <p><strong>Author Tone / Argument:</strong> {analysis.logic.authorTone}</p>
                <ul>{analysis.logic.structure.map((x, idx) => <li key={idx}>{x}</li>)}</ul>
                <ul>{analysis.logic.argumentFlow.map((x, idx) => <li key={idx}>{x}</li>)}</ul>
              </article>

              <article className="card">
                <h3>Questions ({stats.questionCount})</h3>
                {analysis.questions.map((q) => (
                  <div key={q.id} className="question-card">
                    <p><strong>Type:</strong> {q.type}</p>
                    <p><strong>EN:</strong> {q.en}</p>
                    <p><strong>ZH:</strong> {q.zh}</p>
                    <h4>Options</h4>
                    {q.options.map((o) => (
                      <div key={o.label} className="option-row">
                        <p><strong>{o.label}.</strong> {o.en}</p>
                        <p>{o.zh}</p>
                      </div>
                    ))}
                    <h4>Answer Explanation</h4>
                    <p><strong>Correct:</strong> {q.answer}</p>
                    <p>{q.whyCorrect}</p>
                    <p>{q.whyWrong}</p>
                  </div>
                ))}
              </article>
            </div>
          )}
        </section>

        <aside className="right-panel">
          <WordNotesTable notes={notes} onClear={() => setNotes([])} highlightedWord={highlightedWord} />
        </aside>
      </div>

      {popover && (
        <div className="popover" style={{ left: popover.x, top: popover.y }}>
          <p><strong>{popover.word}</strong></p>
          <p>词性：{popover.pos}</p>
          <p>中文：{popover.zh}</p>
          <button onClick={() => addNote()}>记录到笔记</button>
          <button onClick={() => setPopover(null)}>关闭</button>
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
