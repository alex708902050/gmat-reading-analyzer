import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'GMAT Reading Analyzer',
  description: 'OCR and analysis tool for GMAT reading screenshots'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
