"""
Debater Agent
=============
Demonstrates three core OpenAI API concepts in one place:

  1. Streaming chat completions  — tokens arrive as they're generated
  2. Tool / function calling     — model decides when to call search_web
  3. Message history management  — the agent "remembers" past turns

The key pattern is the AGENTIC LOOP:
  ┌─────────────────────────────────────────────────────┐
  │  Call model (streaming)                             │
  │       │                                             │
  │  Tool calls in response?                            │
  │       ├─ YES → execute tools → add results → loop  │
  │       └─ NO  → yield final content → stop          │
  └─────────────────────────────────────────────────────┘
"""

import json
from typing import AsyncGenerator

from openai import AsyncOpenAI
from tools.search import SEARCH_TOOL, mock_search


class DebaterAgent:
    """
    A single debate agent with its own message history and a search tool.

    Each DebaterAgent maintains its own `messages` list — this is the agent's
    "working memory" for the debate. The system prompt gives it a persona and
    a fixed stance; everything else emerges from the model.
    """

    def __init__(self, name: str, stance: str, api_key: str, model: str = "gpt-4o"):
        """
        name:   Display name shown in the UI (e.g. "Axiom")
        stance: "for" or "against" the debate topic
        """
        self.name = name
        self.stance = stance
        self.model = model
        # Client is created per-agent so each debate request uses the user's key
        self.client = AsyncOpenAI(api_key=api_key)
        # ── Message History ───────────────────────────────────────────────
        # OpenAI's Chat Completions API is stateless — you send the full
        # conversation every time. This list IS the agent's memory.
        # Format: [{"role": "user"|"assistant"|"tool", "content": "..."}]
        self.messages: list[dict] = []

    def _system_prompt(self, topic: str) -> str:
        """
        System prompts define the agent's identity and behavior.
        This is separate from `self.messages` — it's injected fresh
        at the top of every API call, not stored in history.
        """
        stance_label = "FOR" if self.stance == "for" else "AGAINST"
        return f"""You are {self.name}, a razor-sharp debate agent arguing {stance_label} the following topic:

Topic: "{topic}"

Your mandate:
- Build persuasive, well-structured arguments {self.stance} this position
- Use the search_web tool to find supporting evidence — cite sources when you do
- Keep each turn to 2-3 focused paragraphs; quality over quantity
- When rebutting, directly address your opponent's specific claims
- Never concede your position; find the strongest possible counter

Speak confidently and directly. You are here to WIN."""

    async def argue(
        self,
        topic: str,
        opponent_argument: str = "",
        round_num: int = 1,
    ) -> AsyncGenerator[dict, None]:
        """
        Generate an argument or rebuttal, yielding SSE-style event dicts.

        This is an async generator — callers use `async for event in agent.argue(...)`.
        Events are plain dicts that get JSON-serialised and sent over SSE.

        Possible event types:
          token       — a streaming text chunk (append to UI)
          tool_call   — agent is calling search_web (show spinner)
          tool_result — tool finished (hide spinner)
          agent_end   — turn is complete (full_content = everything said)
        """

        # ── Build the user prompt for this turn ───────────────────────────
        if round_num == 1 and not opponent_argument:
            user_content = (
                f'Make your opening argument {self.stance} the topic: "{topic}". '
                "Start strong — establish your core thesis immediately."
            )
        else:
            user_content = (
                f"Your opponent just argued:\n\n{opponent_argument}\n\n"
                "Now deliver your rebuttal. Attack their weakest points first."
            )

        self.messages.append({"role": "user", "content": user_content})

        # ═══════════════════════════════════════════════════════════════════
        # THE AGENTIC LOOP
        # We loop because the model may call tools multiple times before
        # giving its final text response. Each iteration:
        #   1. Call the model (stream)
        #   2. Collect content tokens AND tool call chunks
        #   3. If tool calls → execute → add results → go back to step 1
        #   4. If no tool calls → we have the final response → break
        # ═══════════════════════════════════════════════════════════════════
        while True:

            # ── Step 1: Streaming API call ─────────────────────────────────
            # `stream=True` returns an async iterator of chunks instead of
            # waiting for the full response. Each chunk has a `delta` with
            # partial content or partial tool call data.
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._system_prompt(topic)},
                    *self.messages,  # full history so the model has context
                ],
                tools=[SEARCH_TOOL],
                # tool_choice options:
                #   "auto"     → model decides whether to use a tool (what we want)
                #   "required" → model MUST call a tool this turn
                #   "none"     → disable tools entirely
                tool_choice="auto",
                stream=True,
            )

            # ── Step 2: Process streaming chunks ──────────────────────────
            full_content = ""
            # Tool calls arrive fragmented across chunks; accumulate by index.
            # index → {"id": str, "name": str, "arguments": str}
            tool_calls_raw: dict[int, dict] = {}

            async for chunk in stream:
                choice = chunk.choices[0]
                delta = choice.delta

                # Regular text content: stream immediately to frontend
                if delta.content:
                    full_content += delta.content
                    yield {"type": "token", "agent": self.name, "content": delta.content}

                # Tool call chunks: each chunk carries a fragment of the call.
                # The model might call multiple tools (multiple indexes).
                if delta.tool_calls:
                    for tc_chunk in delta.tool_calls:
                        idx = tc_chunk.index
                        if idx not in tool_calls_raw:
                            tool_calls_raw[idx] = {"id": "", "name": "", "arguments": ""}

                        if tc_chunk.id:
                            tool_calls_raw[idx]["id"] = tc_chunk.id
                        if tc_chunk.function:
                            if tc_chunk.function.name:
                                tool_calls_raw[idx]["name"] += tc_chunk.function.name
                            if tc_chunk.function.arguments:
                                tool_calls_raw[idx]["arguments"] += tc_chunk.function.arguments

            tool_calls = list(tool_calls_raw.values())

            # ── Step 3: Handle tool calls (if any) ────────────────────────
            if tool_calls:
                # IMPORTANT: When the model wants to call tools, we must add
                # the assistant message WITH the tool_calls field to history.
                # This is how OpenAI knows which tool results match which calls.
                self.messages.append(
                    {
                        "role": "assistant",
                        "content": full_content or None,
                        "tool_calls": [
                            {
                                "id": tc["id"],
                                "type": "function",
                                "function": {
                                    "name": tc["name"],
                                    "arguments": tc["arguments"],
                                },
                            }
                            for tc in tool_calls
                        ],
                    }
                )

                # Execute each tool and add its result to history
                for tc in tool_calls:
                    args = json.loads(tc["arguments"])
                    query = args.get("query", "")

                    yield {"type": "tool_call", "agent": self.name, "tool": tc["name"], "query": query}

                    result = mock_search(query)  # swap for real search later

                    yield {"type": "tool_result", "agent": self.name, "tool": tc["name"]}

                    # Tool results use role="tool" with the matching tool_call_id.
                    # This pairs the result to the call the model made.
                    self.messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "content": result,
                        }
                    )

                # Loop back — model will now see the tool results and continue
                continue

            # ── Step 4: No tool calls → turn is complete ───────────────────
            self.messages.append({"role": "assistant", "content": full_content})
            break

        yield {"type": "agent_end", "agent": self.name, "content": full_content}

    def full_transcript(self) -> str:
        """
        Concatenate all of this agent's assistant messages.
        Used by the judge to evaluate the full debate.
        """
        return "\n\n---\n\n".join(
            msg["content"]
            for msg in self.messages
            if msg["role"] == "assistant" and msg.get("content")
        )
