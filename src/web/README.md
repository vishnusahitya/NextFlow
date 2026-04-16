# NextFlow Next.js Migration (Phase 2)

This package contains the Next.js App Router migration for NextFlow with:

- Clerk authentication and protected routes
- Prisma ORM and PostgreSQL (Neon-ready)
- Trigger.dev task definitions for LLM and media node execution
- React Flow workflow builder with Zustand state
- Zod-validated API routes for workflows and execution history

## Setup

1. Install dependencies in this package:
   - `npm install --prefix src/web`
2. Copy env file:
   - `copy src\\web\\.env.example src\\web\\.env.local`
3. Fill in keys for Clerk, Neon, Gemini, Trigger.dev, and Transloadit.
4. Generate Prisma client:
   - `npm --prefix src/web run prisma:generate`
5. Run migrations:
   - `npm --prefix src/web run prisma:migrate`
6. Start Next.js app:
   - `npm --prefix src/web run dev`

## Trigger Tasks

Task definitions live in `src/web/trigger/tasks`.

- `node-run-llm`
- `node-crop-image`
- `node-extract-frame`

`/api/workflows/[id]/execute` tries Trigger.dev first. If Trigger is not reachable and `TRIGGER_REQUIRED=false`, it falls back to local executors for development.

## Notes

- Workflow routes are auth-protected by `middleware.ts`.
- All workflow and execution records are scoped to the authenticated Clerk user ID.
- Media tasks use FFmpeg through `ffmpeg-static` and return data URLs by default.
