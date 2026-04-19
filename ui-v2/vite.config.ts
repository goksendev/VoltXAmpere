// VoltXAmpere v2 — Vite yapılandırması.
// Production'da voltxampere.com/v2/ altında servis edilecek; base path '/v2/'.
// Dev server v1 ile çakışmayacak şekilde 5174 portunda çalışır (v1 `python3 -m http.server 8765` kullanır).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // Tüm statik asset URL'leri /v2/ önekiyle üretilsin.
  base: '/v2/',

  resolve: {
    alias: {
      // v1'in engine klasörüne READ-ONLY köprü (Sprint 0.4).
      // v2 kodu yalnızca bu alias üstünden engine'e erişmeli, ve sadece
      // ui-v2/src/bridge/ altından. v1 kodu kopyalanmıyor, taşınmıyor —
      // Vite build aşamasında ihtiyaç duyulan dosyalar ui-v2/dist'e inline'lanır.
      '@v1-engine': path.resolve(__dirname, '../src/engine'),
    },
  },

  server: {
    port: 5174,
    strictPort: true,
    host: 'localhost',
  },

  preview: {
    port: 5175,
    strictPort: true,
  },

  build: {
    // Çıktı ui-v2/dist/ klasörüne yazılır. Vercel build sonrası bu klasör
    // root vercel.json'daki rewrite kuralıyla /v2/* path'ine map'lenir.
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    // Küçük iskelet — chunk uyarı eşiğini düşük tutuyoruz ki ileride kaçak büyüme fark edilsin.
    chunkSizeWarningLimit: 256,
  },

  // Lit 3 sınıf dekoratörleri için TS "experimentalDecorators" yeterli; Vite ek transform istemez.
});
