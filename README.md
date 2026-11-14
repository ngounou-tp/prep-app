# Foreword

A pre-meeting briefing agent. Give it a meeting time and one to five subjects (companies and
people) and it returns a one-page briefing on the 30 days before the meeting, with a source
on every claim. Built for the Global AI Hackathon, Problem Statement 05.

Claims reach the page only when code finds their quote in a cited source. Status (verified,
single source, could not verify) is assigned by code, never by the model.

## What it does

- **One form, under a minute.** The meeting first (when, and what kind: sales call, investor,
  partnership, business development, first intro, or Other in the user's own words), then up to
  five companies or people; a person can name their company.
- **Calendar invite import.** Drop or pick an `.ics` file: the meeting time is set from it and
  its attendees and their company domains are offered as subjects. The file is read in the
  browser and never uploaded.
- **Live progress.** Searches, sources found and quote checks stream in as they happen, with the
  30-day timeline filling in.
- **A one-page briefing.** Snapshot, at most eight developments across all subjects with a status
  badge and source IDs on each, and questions to ask tied to the claim behind them.
- **Sharper questions, and more on request.** Open questions on what each finding means for the
  meeting, plus questions beyond the findings (goals, who decides, what could block the work).
  "Want more questions?" reveals them instantly. Code drops any question beyond the findings that
  mentions a number or a name the briefing does not contain, so none can slip in an invented fact.
- **Evidence on demand.** Each development opens the exact sentence found in its source.
- **One-page PDF.** Print or Save as PDF gives a separate A4 layout with only what is needed in
  the room. Just before printing it measures itself and shrinks (down to 80%) to stay on one page.
- **Listen.** The briefing is read aloud with the browser's own speech, for prep on the way.
- **Your briefings.** Finished briefings are kept in this browser (IndexedDB, newest 30) and can be
  reopened, shared as a link that prepares them afresh, or deleted. No account, no server storage.
- **Honest gaps.** A subject that fails or runs out of time is named, and the rest of the briefing
  still arrives. When nothing is found, the page says so instead of padding.

## Problem statement checklist

| Requirement (Problem Statement 05) | Where it is met |
| --- | --- |
| Accept a company or person and the meeting time | Landing form; 1 to 5 subjects, or import from an invite (`lib/types/input.ts`) |
| Developments from the preceding 30 days: news, launches, hires | `lib/research/window.ts` and `queries.ts`; off-window sources dropped in `sources.ts` |
| Structured, one-page report | Page budget of 8 developments (`lib/briefing/pageBudget.ts`); A4 print layout |
| Sources for factual claims | Every claim carries source IDs; code checks its quote in the source (`lib/briefing/verify.ts`) |
| Open questions for the meeting | Questions tied to claims, plus questions beyond the findings checked by code (`lib/briefing/openQuestions.ts`); shown and printed as "Ask in the room" |
| Distinguish verified from uncertain | Verified, single source and could not verify, set by code with icon and label |
| Avoid inventing unsupported details | Claims without a found quote never reach the page; the writer sees checked claims only |
| Sales, partnership, investor, business development | Meeting type chips, plus Other; the type shapes the questions |
| Tavily and Bifrost | All research through `lib/research/tavily.ts`; every model call through Bifrost with fallbacks (`lib/model/llm.ts`) |

## Stack

Next.js (App Router), TypeScript in strict mode, Tailwind CSS, zod, date-fns and vitest.
Research uses the Tavily Search API; every model call goes through a Bifrost gateway.

## Getting started

Requires Node.js 22.12 or newer (vitest's minimum; Next.js needs 20.9).

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

`.env.example` documents every variable. `TAVILY_API_KEY` and `BIFROST_URL` are required; the
rest have defaults. `BIFROST_MODEL=auto` (the default) uses the first chat model the gateway
offers that answers, preferring stable models over previews. `.env.local` is git-ignored and must never be committed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types, then `tsc --noEmit` |
| `npm test` | Vitest. Every external call is mocked; no credits are spent |
| `npm run try-research -- "<name>"` | Runs real research and lists the sources (spends Tavily credits) |
| `npm run try-briefing -- "<name>"` | Runs a real briefing and saves it to `.briefings/latest.json` (spends credits) |
| `npm run save-fixture` | Copies the latest real briefing to `fixtures/sample-briefing.json` |
| `npm run check-model` | Sends one tiny request through Bifrost and names the model that answered (spends a few tokens) |

Subjects for the `try-*` scripts: `"Company name"`, `"person:Full Name"` or
`"person:Full Name@Their Company"`. With `USE_FIXTURE=1` in development, the app returns the
saved fixture instead of calling Tavily or the model.

## Deploy (Railway or Render, Docker)

Foreword deploys on **Railway** or on **Render**, whichever is available. Nothing in the code
changes between them: both run the same two Docker images.

- **foreword**: this app (`Dockerfile`, a standalone Next.js server on port 10000, or on `PORT` when
  the host sets it).
- **foreword-gateway** (Railway) or **foreword-bifrost** (Render): the Bifrost gateway
  (`bifrost/Dockerfile`, pinned to v2.5.1, configured by `bifrost/config.json`). It is locked down:
  every model call needs the virtual key, the dashboard needs the admin login, and only chat models
  of Groq and Gemini are allowed. On Railway it is also private; on Render it is public, because
  private services are not free there.

Every push runs `.github/workflows/ci.yml`: lint, types, tests and build; the app image is started
and must serve the page; the gateway image is started and must refuse calls without the key and
the admin API without a login. Both hosts are set to deploy `main` only after those pass.

### Option 1: Railway

1. Push the repository to GitHub (`origin` is `github.com/ngounou-tp/prep-app`).
2. In Railway, **New Project > Deploy from GitHub repo**, pick this repository. Railway finds the
   root `Dockerfile`. Rename the service `foreword`.
3. In the same project, **Create > GitHub Repo**, the same repository again. In its **Settings**, set
   **Root Directory** to `/bifrost` and rename it `foreword-gateway`. Do not generate a domain for it.
4. On **foreword-gateway > Variables**: `GROQ_API_KEY`, `GEMINI_API_KEY`, `BIFROST_ADMIN_USERNAME`,
   `BIFROST_ADMIN_PASSWORD`, and `BIFROST_VIRTUAL_KEY`: any long random value that starts with `sk-bf-`.
   Under **Settings > Deploy**, set the healthcheck path to `/health`.
5. On **foreword > Variables** (Railway fills in the references):

   | Name | Value |
   | --- | --- |
   | `TAVILY_API_KEY` | Your Tavily key |
   | `BIFROST_URL` | `http://${{foreword-gateway.RAILWAY_PRIVATE_DOMAIN}}:10000` |
   | `BIFROST_API_KEY` | `${{foreword-gateway.BIFROST_VIRTUAL_KEY}}` |
   | `BIFROST_MODEL` | `auto` |
   | `BIFROST_FALLBACK_MODELS` | `auto` |
   | `LLM_PAUSE_MS` | `3000`: free-tier providers rate-limit back-to-back calls |

   Under **Settings > Deploy**, set the healthcheck path to `/`; under **Networking**, generate a
   public domain.
6. On both services, **Settings > Source**: turn on **Wait for CI**. For the gateway, set the watch
   path to `/bifrost/**` so it rebuilds only when its own files change.

Railway gives new accounts trial credit, then charges by usage on a paid plan; check its pricing page.

### Option 2: Render

1. Push the repository to GitHub.
2. In Render, choose **New > Blueprint**, pick this repository, and apply `render.yaml`. It creates
   both services, deploying only after CI passes (`autoDeployTrigger: checksPass`).
3. Enter the secrets when Render asks:
   - foreword-bifrost: `GROQ_API_KEY`, `GEMINI_API_KEY`, `BIFROST_ADMIN_USERNAME`,
     `BIFROST_ADMIN_PASSWORD`, and `BIFROST_VIRTUAL_KEY` (starts with `sk-bf-`). Render copies it to
     Foreword, so it is entered once.
   - foreword: `TAVILY_API_KEY`, and `BIFROST_URL`: the gateway's address as Render shows it, such
     as `https://foreword-bifrost.onrender.com`.

Free Render services sleep after 15 minutes without traffic and take up to a minute to wake, and
free instance hours are shared across a workspace.

### Either way

After the first setup, merging to `main` is the whole release. To try the app image locally:

```bash
docker build -t foreword .
docker run --rm -p 10000:10000 --env-file .env.local foreword   # http://localhost:10000
```

The gateway loads its model catalogue before it answers, which can take a minute after a deploy.
When a host puts it to sleep, opening the form wakes it in the background (`POST /api/wake`, at most
once a minute). Open the app a minute before a demo.

## Project structure

```text
app/                    Routes and pages only
  api/briefing/route.ts   POST /api/briefing
  briefing/, saved/       The briefing run and a briefing saved in this browser
components/             Presentational components: landing/, progress/, result/, saved/
lib/
  config/               Environment validation, development fixture
  research/             30-day window, queries, Tavily client, source cleaning
  model/                Bifrost client, response parsing, prompts
  briefing/             Orchestrator, verification, page budget, progress, time budget
  http/                 API request handling and rate limiting
  client/               Browser-safe logic: stream reader, form, invite import, read aloud,
                        saved briefings, print fit; pure and tested in Node
  shared/               Concurrency limiter, the quote matcher
  types/                zod schemas; every type is inferred from them
tests/                  Mirrors lib/; components/ run in jsdom; shared fakes in tests/support/
scripts/                Developer scripts (run with tsx)
design/                 Reference designs
```

## How a briefing is made

1. **Window**: the 30 days up to the meeting, or up to today if the meeting is later.
2. **Search**: a few Tavily searches per subject, at most 12 per briefing.
3. **Clean**: drop duplicate, off-window and non-http sources, then trim and rank the rest.
4. **Extract**: one model call per subject, which sees only that subject's sources.
5. **Verify**: code checks each quote against its source, merges one fact reported by several sites,
   and assigns the status: Verified needs the quote found and two independent sites.
6. **Write**: one model call for the snapshot and questions, given verified and single-source claims only.

A briefing stays under 55 seconds. A subject that fails or runs out of time gets a note
instead of failing the whole briefing.

## API

`POST /api/briefing` takes JSON (8 KB at most) and answers with newline-delimited JSON:
progress events (`searching`, `sources`, `checking`, `writing`, `done`), then one final
`result` or `error` line. Invalid input returns 400 with field messages. The rate limit is
15 subjects per 10 minutes per IP and returns 429 with `Retry-After` when exceeded.
`lib/client/streamBriefing.ts` reads the stream in the browser.
