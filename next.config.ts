import type { NextConfig } from 'next';

const FIREBASE_HOST = 'https://mathnavi-a1e01.firebaseapp.com';

// 舊版（Vite）用 VITE_FIREBASE_*；新版用 NEXT_PUBLIC_FIREBASE_*。兩種名稱都吃，Vercel 上不必改環境變數
const pick = (next: string, vite: string) => process.env[next] || process.env[vite] || '';

// GitHub Pages 版：純靜態輸出（沒有伺服器），放在 /<repo 名稱>/ 底下；AI 請求改打 Vercel 上的 API
const PAGES = process.env.GITHUB_PAGES === '1';
const BASE_PATH = PAGES ? process.env.PAGES_BASE_PATH || '/mathnavi' : '';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: pick('NEXT_PUBLIC_FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY'),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: pick('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN'),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: pick('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID'),
    NEXT_PUBLIC_FIREBASE_APP_ID: pick('NEXT_PUBLIC_FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID'),
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || '',
  },
  // 後端只在伺服器執行；firebase-admin 不要被打包進前端
  serverExternalPackages: ['firebase-admin'],
  ...(PAGES
    ? { output: 'export' as const, basePath: BASE_PATH, trailingSlash: true, images: { unoptimized: true } }
    : {
        async rewrites() {
          // Google 登入的 redirect 流程：把 /__/auth 代理到 Firebase，讓登入網域與網站同網域
          return [
            { source: '/__/auth/:path*', destination: `${FIREBASE_HOST}/__/auth/:path*` },
            { source: '/__/firebase/:path*', destination: `${FIREBASE_HOST}/__/firebase/:path*` },
          ];
        },
        async headers() {
          return [
            // Service Worker 本身不能被長期快取，否則更新不會生效
            { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
          ];
        },
      }),
};

export default nextConfig;
