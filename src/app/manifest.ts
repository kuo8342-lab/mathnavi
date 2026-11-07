import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

// PWA：手機／電腦可「安裝」成 App
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '數學解題通 MathNavi',
    short_name: '數學解題通',
    description: '拍照上傳國中數學題，AI 引導解題、錯題本與個人學習輪廓。',
    lang: 'zh-TW',
    theme_color: '#0284C7',
    background_color: '#F8FAFC',
    display: 'standalone',
    start_url: `${BASE}/`,
    scope: `${BASE}/`,
    icons: [
      { src: `${BASE}/pwa-64x64.png`, sizes: '64x64', type: 'image/png' },
      { src: `${BASE}/pwa-192x192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${BASE}/pwa-512x512.png`, sizes: '512x512', type: 'image/png' },
      { src: `${BASE}/maskable-icon-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
