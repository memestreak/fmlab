# fmlab

An interactive guide to FM synthesis, at https://fmlab.pages.dev: nine
named sections in four groups (Basics, Two operators, The DX7, Play),
each with a lab to play with and hear, and a glossary.

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
