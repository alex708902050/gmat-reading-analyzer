'use client';

import { useMemo, useState } from 'react';
import Tesseract from 'tesseract.js';
import { AnalysisResult, WordLookup } from '@/lib/types';
import { WordNotesTable, type NoteRow } from '@/components/WordNotesTable';

type PopoverState = {
  word: string;
  pos: string;
  zh: string;
  sentence: string;
  x: number;
  y: number;
} | null;

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [popover, setPopover] = useState<PopoverState>(null);
  const [message, setMessage] = useState('');

  const runOCR = async (files: FileList) => {
    const texts: string[] = [];
    for (const file of Array.from(files)) {
      const result = await Tesseract.recognize(file, 'eng');
      texts.push(result.data.text);
    }
    return texts.join('\n\n');
  };

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    setLoading(true);
    setAnalysis(null);
    setMessage('正在进行 OCR 与分析...');

    try {
      const text = await runOCR(files);
      setOcrText(text);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = (await res.json()) as AnalysisResult;
      setAnalysis(data);
      setMessage('分析完成。上传新截图会刷新左侧分析，右侧笔记保留。');
    } catch (error) {
      console.error(error);
      setMessage('处理失败，请重试。');
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
    const sentence = (range.startContainer.textContent ?? '').slice(0, 60);

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

  const addNote = () => {
    if (!popover) return;
    const exists = notes.some((n) => n.word.toLowerCase() === popover.word.toLowerCase());
    if (exists) {
      alert(`重复单词：${popover.word}`);
      return;
    }
    setNotes((prev) => [...prev, { word: popover.word, pos: popover.pos, zh: popover.zh, sentence: popover.sentence }]);
    setPopover(null);
  };

  const stats = useMemo(() => ({
    sentenceCount: analysis?.article.sentences.length ?? 0,
    questionCount: analysis?.questions.length ?? 0
  }), [analysis]);

  return (
    <main className="page">
      <h1>GMAT 阅读截图分析工具（MVP）</h1>
      <input multiple type="file" accept="image/*" onChange={onUpload} />
      <p>{loading ? '处理中...' : message}</p>

      <div className="split">
        <section className="left" onMouseUp={onTextMouseUp}>
          <h2>左侧：分析结果</h2>
          <p>句子数：{stats.sentenceCount} ｜题目数：{stats.questionCount}</p>

          {analysis ? (
            <>
              <h3>一、文章部分</h3>
              <pre>{analysis.article.original}</pre>
              {analysis.article.sentences.map((s, idx) => (
                <div key={idx} className="sentence-row">
                  <p><strong>EN:</strong> {s.en}</p>
                  <p><strong>ZH:</strong> {s.zh}</p>
                </div>
              ))}

              <h3>二、文章逻辑分析</h3>
              <p><strong>主旨：</strong>{analysis.logic.mainIdea}</p>
              <ul>{analysis.logic.structure.map((x, idx) => <li key={idx}>{x}</li>)}</ul>
              <ul>{analysis.logic.argumentFlow.map((x, idx) => <li key={idx}>{x}</li>)}</ul>

              <h3>三~五、题目、选项与答案解析</h3>
              {analysis.questions.map((q) => (
                <article key={q.id} className="question-card">
                  <p><strong>题干 EN：</strong>{q.en}</p>
                  <p><strong>题干 ZH：</strong>{q.zh}</p>
                  {q.options.map((o) => (
                    <div key={o.label}>
                      <p>{o.label}. {o.en}</p>
                      <p>中译：{o.zh}</p>
                    </div>
                  ))}
                  <p><strong>正确答案：</strong>{q.answer}</p>
                  <p><strong>为什么正确：</strong>{q.whyCorrect}</p>
                  <p><strong>其他选项为何错误：</strong>{q.whyWrong}</p>
                </article>
              ))}
            </>
          ) : (
            <p>请上传截图开始分析。</p>
          )}

          {ocrText && (
            <details>
              <summary>查看 OCR 原始文本</summary>
              <pre>{ocrText}</pre>
            </details>
          )}
        </section>

        <section className="right">
          <h2>右侧：单词笔记区</h2>
          <WordNotesTable notes={notes} onClear={() => setNotes([])} />
        </section>
      </div>

      {popover && (
        <div className="popover" style={{ left: popover.x, top: popover.y }}>
          <p><strong>{popover.word}</strong></p>
          <p>词性：{popover.pos}</p>
          <p>中文：{popover.zh}</p>
          <button onClick={addNote}>记录到笔记</button>
          <button onClick={() => setPopover(null)}>关闭</button>
        </div>
      )}
    </main>
  );
}
