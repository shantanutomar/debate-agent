# Debate Agent

Two AI agents argue opposite sides of any topic. A judge agent evaluates the debate and picks a winner.

Built to learn agentic AI patterns with the OpenAI SDK.

## What it demonstrates

| Concept | Where |
|---|---|
| Streaming chat completions | `api/agents/debater.py` |
| Tool / function calling | `api/agents/debater.py` + `api/tools/search.py` |
| The agentic loop | `DebaterAgent.argue()` |
| Message history management | `self.messages` in `DebaterAgent` |
| Structured / JSON output | `api/agents/judge.py` |
| Multi-agent orchestration | `api/agents/orchestrator.py` |
| SSE streaming to React | `api/main.py` + `web/src/hooks/useDebateStream.ts` |

## Stack

- **Backend:** Python 3.11+ · FastAPI · OpenAI Python SDK
- **Frontend:** React 18 · TypeScript · Tailwind CSS v4 · Vite · Bun

## Setup

### Backend

```bash
cd api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Create api/.env with your key
echo "OPENAI_API_KEY=sk-..." > .env

uvicorn main:app --reload
# → http://localhost:8000
```

### Frontend

```bash
cd web
bun install
bun dev
# → http://localhost:5173
```

## Project structure

```
debate-agent/
├── api/
│   ├── agents/
│   │   ├── debater.py      ← streaming + tool calling (read this first)
│   │   ├── judge.py        ← structured output
│   │   └── orchestrator.py ← multi-agent coordination
│   ├── tools/
│   │   └── search.py       ← mock tool (swap for Tavily to make it real)
│   └── main.py             ← FastAPI + SSE endpoint
└── web/
    └── src/
        ├── hooks/useDebateStream.ts   ← SSE → React state
        ├── types/debate.ts            ← all shared types
        └── components/                ← UI
```

## Upgrading the search tool

Replace `mock_search()` in `api/tools/search.py` with a real call:

```python
import httpx

def mock_search(query: str) -> str:
    r = httpx.get(
        "https://api.tavily.com/search",
        params={"query": query, "api_key": os.getenv("TAVILY_API_KEY")}
    )
    return r.text
```
