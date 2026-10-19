# Contract Requests from Frontend (Antigravity)

## 2026-10-18: Initial OpenAPI Contract Export
- **Requested By:** Frontend Team
- **Request:** Once Phase 0/1 backend endpoints are ready, run `pnpm --filter api export:openapi` to generate `packages/contracts/openapi.json`.
- **Status:** Done. `packages/contracts/openapi.json` is generated and committed.

## 2026-10-19: Phase 2 contract published
- **Branch:** `backend/phase2`. Nutrition logs, articles, admin users/stats and admin vaccines are in `packages/contracts/openapi.json`. Response bodies are not typed in the contract; use the models in `docs/superpowers/plans/2026-10-19-phase2-frontend.md`.
