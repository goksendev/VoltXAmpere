// VoltXAmpere v2 — Vite yapılandırması.
// Production'da voltxampere.com/v2/ altında servis edilecek; base path '/v2/'.
// Dev server v1 ile çakışmayacak şekilde 5174 portunda çalışır (v1 `python3 -m http.server 8765` kullanır).
import { defineConfig } from 'vite';

export default defineConfig({
  // Tüm statik asset URL'leri /v2/ önekiyle üretilsin.
  base: '/v2/',

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
