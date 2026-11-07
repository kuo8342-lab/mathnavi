import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// 由 public/icon.svg 產生各尺寸 App 圖示：npm run icons
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0284C7' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0284C7' } },
  },
  images: ['public/icon.svg'],
});
