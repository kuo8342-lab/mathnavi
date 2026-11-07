import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../index.css';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  title: '數學解題通 MathNavi',
  description: '數學解題通 MathNavi：拍照上傳數學題目，AI 協助理解、解題與個人化學習。',
  openGraph: {
    title: '數學解題通 MathNavi',
    description: '拍照上傳數學題目，AI 協助理解、解題與個人化學習。',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
  appleWebApp: { capable: true, title: '數學解題通' },
  icons: {
    icon: [
      { url: `${BASE}/favicon.ico`, sizes: '48x48' },
      { url: `${BASE}/icon.svg`, type: 'image/svg+xml' },
    ],
    apple: `${BASE}/apple-touch-icon-180x180.png`,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0284C7',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Noto+Sans+TC:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#F8FAFC] text-[#0F172A] antialiased selection:bg-[#0284C7]/15 selection:text-[#0284C7]">
        {children}
      </body>
    </html>
  );
}
