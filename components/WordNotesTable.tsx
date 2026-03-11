'use client';

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

export type NoteRow = {
  word: string;
  pos: string;
  zh: string;
  sentence: string;
};

type Props = {
  notes: NoteRow[];
  onClear: () => void;
  highlightedWord?: string;
};

export function WordNotesTable({ notes, onClear, highlightedWord }: Props) {
  const [search, setSearch] = useState('');

  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(notes);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'WordNotes');
    XLSX.writeFile(workbook, 'gmat-word-notes.xlsx');
  };

  const filtered = useMemo(() => {
    const key = search.trim().toLowerCase();
    if (!key) return notes;
    return notes.filter((row) => [row.word, row.pos, row.zh, row.sentence].some((item) => item.toLowerCase().includes(key)));
  }, [notes, search]);

  return (
    <div className="notes-panel">
      <div className="notes-head">
        <h3>Word Notes</h3>
        <span>{notes.length} entries</span>
      </div>
      <input
        className="notes-search"
        placeholder="搜索单词 / 翻译 / 句子"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="notes-actions">
        <button onClick={exportExcel} disabled={notes.length === 0}>导出 Excel</button>
        <button onClick={onClear} disabled={notes.length === 0}>一键清空</button>
      </div>
      <div className="notes-table-wrap">
        <table className="notes-table">
          <thead>
            <tr>
              <th>单词或词组</th>
              <th>词性</th>
              <th>中文翻译</th>
              <th>所在句子（缩写）</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4}>{notes.length === 0 ? '暂无笔记' : '未命中搜索结果'}</td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr key={`${row.word}-${idx}`} className={highlightedWord?.toLowerCase() === row.word.toLowerCase() ? 'highlight-row' : ''}>
                  <td>{row.word}</td>
                  <td>{row.pos}</td>
                  <td>{row.zh}</td>
                  <td>{row.sentence}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
