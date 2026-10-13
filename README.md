# fmlab

An interactive guide to FM synthesis.

A single page, built with Vite, vanilla TypeScript and Canvas 2D; no UI
framework. `CLAUDE.md` describes the layout and the styling rules,
`DEPLOYMENT.md` the Cloudflare Pages setup.

## Development

```bash
npm install
npm run dev      # Dev server at localhost:5173
npm run build    # Production build to dist/
npm run lint     # ESLint
npm test         # Vitest
npm run typecheck  # tsc --noEmit
```

CI (`.github/workflows/ci.yml`) runs lint, tests, the build and the type
check on every pull request and every push to `main`.
