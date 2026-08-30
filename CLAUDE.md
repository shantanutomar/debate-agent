# debate-agent — Handoff Document

Read this fully before starting implementation. All decisions from the alignment session are captured here.

---

## What and why

A multi-agent debate app where two AI agents argue opposite sides of any topic, and a judge agent evaluates and picks a winner.

**Purpose:** Learning and showcase. The primary goal is understanding agentic AI patterns — streaming, tool calling, the agentic loop, multi-agent orchestration, structured output. Code quality and concept clarity matter more than feature richness.

**Audience:** The developer (Shantanu) — a full-stack engineer proficient in React and Node.js/Python, new to agentic AI development.

---

## Decisions made

### Backend
- **Python** over TypeScript — user wants to learn Python in an async/agentic context
- **FastAPI** over Flask or Express — user wants to learn FastAPI specifically; async-first fits SSE streaming naturally
- **OpenAI Python SDK** (raw, `openai>=1.50`) — no LangChain or agent framework; the point is to understand the primitives
- **`gpt-4o`** as the model — best balance of capability and tool-calling reliability
- **SSE (Server-Sent Events)** over WebSockets — one-directional stream from server to client is sufficient; simpler than WS

### Frontend
- **React + TypeScript** — user is already proficient; focus stays on the agentic concepts
- **Tailwind CSS v4** — `@tailwindcss/vite` plugin, `@import "tailwindcss"` in CSS (no config file needed)
- **Bun + Vite** — fast dev experience; Bun as package manager
- **fetch() + ReadableStream** for SSE — browser EventSource is GET-only, can't POST; manual stream parsing in a React hook

### Architecture
- **Orchestrator pattern** — one `DebateOrchestrator` creates and coordinates `DebaterAgent` and `JudgeAgent` instances
- Two debater agents: **Axiom** (for) and **Nexus** (against) — fixed names, memorable
- **2 rounds** of debate: opening arguments → rebuttals → judge verdict
- Each agent maintains its own `self.messages` list — never shared between agents
- All backend events are plain dicts (JSON-serialisable); `type` field is the discriminant, mirrored as a TypeScript discriminated union on the frontend

### Search tool
- **Mocked** for now (`mock_search()` returns plausible fake results) — no Tavily API key available
- The tool schema (`SEARCH_TOOL`) and agent code are decoupled — swapping real search requires changing only `mock_search()` in `api/tools/search.py`

---

## Explicitly ruled out

- **LangChain / any agent framework** — defeats the learning purpose; use raw OpenAI SDK only
- **WebSockets** — overkill for a one-directional stream
- **Real web search (Tavily)** for now — mocked; can be added later without touching agent code
- **Authentication** — not needed for a learning/showcase app
- **Docker** — not needed for local development
- **CI/CD** — out of scope

---

## Architecture

```
User submits topic
      │
      ▼
POST /api/debate/stream  (FastAPI)
      │
      ▼
DebateOrchestrator.run()  ← async generator, yields event dicts
      │
      ├─ Round 1 ─ DebaterAgent "Axiom"  (for)     → streams tokens + tool calls
      │          ─ DebaterAgent "Nexus"  (against)  → streams tokens + tool calls
      │
      └─ Round 2 ─ same agents, now rebutting each other
      │
      └─ JudgeAgent.evaluate() → structured JSON verdict (no streaming)
                │
                ▼
         FastAPI SSE stream → fetch() + ReadableStream → useDebateStream hook → React UI
```

### Key concept → file mapping

| Concept | File |
|---|---|
| Streaming chat completions | `api/agents/debater.py` — `argue()` method |
| Tool schema definition | `api/tools/search.py` — `SEARCH_TOOL` dict |
| Tool call chunk accumulation | `api/agents/debater.py` — accumulate by `index` across stream chunks |
| The agentic loop | `api/agents/debater.py` — `while True` loop in `argue()` |
| Message history management | `DebaterAgent.messages` — one list per agent |
| Structured JSON output | `api/agents/judge.py` — `response_format={"type": "json_object"}` |
| Multi-agent orchestration | `api/agents/orchestrator.py` |
| SSE from FastAPI | `api/main.py` — `StreamingResponse`, `data: {...}\n\n` format |
| SSE parsing in React | `web/src/hooks/useDebateStream.ts` |
| TypeScript event types | `web/src/types/debate.ts` — discriminated union on `type` |

---

## What is mocked / temporary

| Item | Location | How to make it real |
|---|---|---|
| Web search | `api/tools/search.py` — `mock_search()` | Replace with Tavily/SerpAPI call; agent code unchanged |

---

## Project structure

```
debate-agent/
├── api/                          ← FastAPI backend
│   ├── agents/
│   │   ├── debater.py            ← read this first — core agentic loop
│   │   ├── judge.py              ← structured output
│   │   └── orchestrator.py       ← multi-agent coordination
│   ├── tools/
│   │   └── search.py             ← mock tool (swap here for real search)
│   ├── main.py                   ← FastAPI app + SSE endpoint
│   └── requirements.txt
└── web/                          ← React frontend
    └── src/
        ├── hooks/useDebateStream.ts   ← SSE → React state
        ├── types/debate.ts            ← all shared types
        └── components/                ← UI components
```

---

## Implementation backlog

Build in this order — each step builds on the previous:

1. **`api/tools/search.py`** — define `SEARCH_TOOL` schema + `mock_search()` function
2. **`api/agents/debater.py`** — `DebaterAgent` class with streaming agentic loop
3. **`api/agents/judge.py`** — `JudgeAgent` with structured JSON output + Pydantic model
4. **`api/agents/orchestrator.py`** — `DebateOrchestrator` coordinating the full flow
5. **`api/main.py`** — FastAPI app, CORS, SSE endpoint
6. **`web/src/types/debate.ts`** — TypeScript discriminated union for all event types
7. **`web/src/hooks/useDebateStream.ts`** — fetch + ReadableStream SSE hook
8. **`web/src/components/`** — AgentPanel, JudgeVerdict, TopicForm
9. **`web/src/App.tsx`** — compose everything

---

## Dev commands

### Backend
```bash
cd api
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env          # then fill in OPENAI_API_KEY
uvicorn main:app --reload        # → http://localhost:8000
```

### Frontend
```bash
cd web
bun install
bun dev                          # → http://localhost:5173
```

> **Node version note:** Vite 5 requires Node 15+. If your system default is older, run `nvm use 20` first (`.nvmrc` is set to `20`).

---

## Environment variables

`api/.env` (copy from root `.env.example`):
```
OPENAI_API_KEY=sk-...
```

---

## Conventions

- All backend events are plain dicts — JSON-serialisable, no custom classes on the wire
- The `type` field on every event is the discriminant (mirrors TypeScript union in `web/src/types/debate.ts`)
- Agent message history lives in `DebaterAgent.messages` — one list per agent, never shared
- Frontend uses `fetch()` + `ReadableStream`, not `EventSource` (EventSource is GET-only)
- Tailwind v4: `@import "tailwindcss"` in CSS — no `tailwind.config.js` needed
- To add real search: replace `mock_search()` in `api/tools/search.py` — agent code does not change

---

## Open questions

- None from the alignment session — all decisions were made. Implementation can begin directly.
