"""
Debate Agent — FastAPI Backend
===============================
Concepts demonstrated:
  - FastAPI route with StreamingResponse (SSE)
  - CORS setup for local React dev server
  - Async generator → HTTP stream bridge
  - Environment variable loading with python-dotenv

SSE (Server-Sent Events) format:
  Each event is a plain-text line starting with "data: " followed by JSON,
  terminated by TWO newlines. The browser's EventSource API parses this
  automatically. We use a manual StreamingResponse here (rather than
  sse-starlette) to keep dependencies minimal and make the format visible.
"""

import json
import os

from dotenv import load_dotenv

load_dotenv(".env.local")  # still loads .env.local so a fallback key can live there

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.orchestrator import DebateOrchestrator

# Fallback key from the environment (optional — users can override via the UI)
_ENV_API_KEY = os.getenv("OPENAI_API_KEY", "")

app = FastAPI(title="Debate Agent API", version="0.1.0")

# ── CORS ───────────────────────────────────────────────────────────────────────
# In development: only localhost:5173 (Vite).
# In production:  set ALLOWED_ORIGINS in Railway dashboard as a comma-separated
#                 list, e.g. "https://debate-agent.vercel.app"
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


# ── Request schema ─────────────────────────────────────────────────────────────
class DebateRequest(BaseModel):
    topic: str
    rounds: int = 2
    # api_key: user-supplied from the UI; falls back to the env-var key if empty
    api_key: str = ""
    model: str = "gpt-4o"


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/debate/stream")
async def stream_debate(request: DebateRequest):
    """
    Start a debate and stream events as Server-Sent Events.

    The client makes ONE POST request and keeps the connection open.
    We yield events as they happen — no polling, no WebSockets needed.

    SSE wire format (what the client receives):
        data: {"type": "token", "agent": "Axiom", "content": "I "}\n\n
        data: {"type": "token", "agent": "Axiom", "content": "believe"}\n\n
        ...
        data: [DONE]\n\n
    """
    # Resolve which API key to use: UI-supplied takes precedence over env-var
    resolved_key = request.api_key.strip() or _ENV_API_KEY
    if not resolved_key:
        raise HTTPException(
            status_code=400,
            detail="No OpenAI API key provided. Enter one in the UI or set OPENAI_API_KEY in api/.env.local.",
        )

    orchestrator = DebateOrchestrator(
        topic=request.topic,
        rounds=request.rounds,
        api_key=resolved_key,
        model=request.model,
    )

    async def event_generator():
        async for event in orchestrator.run():
            # Each SSE message: "data: <json>\n\n"
            yield f"data: {json.dumps(event)}\n\n"
        # Sentinel tells the client the stream is finished
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Prevents nginx/proxies from buffering the stream
            "X-Accel-Buffering": "no",
        },
    )
