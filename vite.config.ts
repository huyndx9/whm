import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "택이네 조개전골 재고 관리",
        short_name: "택이네 재고",
        description: "식당 원재료 재고·발주·판매를 관리하는 앱",
        lang: "ko",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#F8F9FB",
        theme_color: "#0F4C5C",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // 앱 자체를 통째로 캐시해 두면 인터넷 없이도 켜진다.
        // Tesseract 언어 데이터는 용량이 커서 제외한다.
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // 개발 중에도 설치 가능 여부를 확인할 수 있게 한다
        enabled: true,
        type: "module",
      },
    }),
  ],
  // 어떤 경로에 올려도 동작하도록 상대 경로로 빌드한다
  base: "./",
  server: { port: 5178, host: true },
  build: { outDir: "dist", sourcemap: false },
});
