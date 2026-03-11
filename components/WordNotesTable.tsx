'use client';

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
};

export function WordNotesTable({ notes, onClear }: Props) {
  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(notes);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'WordNotes');
    XLSX.writeFile(workbook, 'gmat-word-notes.xlsx');
  };

  return (
    <div className="notes-panel">
      <div className="notes-actions">
        <button onClick={exportExcel} disabled={notes.length === 0}>导出 Excel</button>
        <button onClick={onClear} disabled={notes.length === 0}>一键清空</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>单词/词组</th>
            <th>词性</th>
            <th>中文翻译</th>
            <th>所在句子（缩写）</th>
          </tr>
        </thead>
        <tbody>
          {notes.length === 0 ? (
            <tr>
              <td colSpan={4}>暂无笔记</td>
            </tr>
          ) : (
            notes.map((row, idx) => (
              <tr key={`${row.word}-${idx}`}>
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
  );
}
