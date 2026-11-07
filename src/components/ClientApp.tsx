'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

// 這個 App 整個靠瀏覽器功能（相機、localStorage、Firebase 登入），只在瀏覽器端執行；
// 載入期間先顯示品牌畫面，避免第一次打開時一片空白
function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-slate-500">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />
      <p className="text-sm font-medium">數學解題通 載入中…</p>
    </div>
  );
}

const App = dynamic(() => import('../App'), { ssr: false, loading: () => <Splash /> });

export default function ClientApp() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV === 'production') {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
      navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {});
    } else {
      // 開發時不要留舊的快取，免得看到過期畫面
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    }
  }, []);

  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
