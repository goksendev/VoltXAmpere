# ui-v2/

VoltXAmpere v2 — paralel geliştirme klasörü.

v1'in `src/` klasörü ile hiçbir dosya paylaşılmaz. v1 production'da (`voltxampere.com/`)
çalışmaya devam eder; v2 tamamlanana kadar `voltxampere.com/v2` path'inde yaşar.

## Stack
- Vite 5 (izole proje — kendi `package.json` ve `node_modules`).
- Lit 3 (sadece Lit — React/Vue/Svelte yasak).
- TypeScript 5 (strict mode).

## Geliştirme
- `npm run dev:v2` (repo kökünden) → Vite dev server, `http://localhost:5174`.
- `npm run build:v2` → `ui-v2/dist/` içine production build.

## Sprint Durumu
Sprint 0.1 — iskelet. Canvas, registry, backend bağı YOK.
