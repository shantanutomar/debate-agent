"""
Judge Agent
===========
Demonstrates two additional OpenAI API concepts:

  1. Structured / JSON output  — response_format forces valid JSON
  2. Non-streaming use case    — sometimes you want the full response at once

The judge evaluates the complete debate transcript and returns a
machine-readable verdict that the frontend can render as a rich card.

Alternative (newer) approach: use `client.beta.chat.completions.parse()`
with a Pydantic model — OpenAI SDK v1.50+ will validate and deserialise
the response automatically. Shown in a comment below for reference.
"""

import json

from openai import AsyncOpenAI
from pydantic import BaseModel


# ── Verdict schema (Pydantic) ─────────────────────────────────────────────────
# Pydantic validates that the JSON the model returns matches what we expect.
# If the model hallucinated a field or used the wrong type, Pydantic will
# raise a ValidationError rather than letting bad data reach the frontend.

class JudgeVerdict(BaseModel):
    winner: str           # "a" or "b"
    winner_name: str      # display name of the winner
    score_a: int          # 1–10
    score_b: int          # 1–10
    reasoning: str        # paragraph explaining the decision
    key_points_a: list[str]   # strongest arguments from agent A
    key_points_b: list[str]   # strongest arguments from agent B
    summary: str          # one-paragraph debate recap


class JudgeAgent:
    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def evaluate(
        self,
        topic: str,
        agent_a_name: str,
        agent_b_name: str,
        transcript_a: str,
        transcript_b: str,
    ) -> JudgeVerdict:
        """
        Read both transcripts and return a structured verdict.

        KEY CONCEPT — response_format: {"type": "json_object"}
        This tells the model it MUST return valid JSON. Without it, the model
        might wrap the JSON in markdown fences or add prose around it, which
        would break json.loads(). With it, the raw response is always parseable.
        """

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an impartial debate judge. Evaluate both debaters fairly "
                        "based on: argument quality, use of evidence, logical consistency, "
                        "persuasiveness, and rebuttal effectiveness. The strongest argument "
                        "wins — your personal view on the topic is irrelevant. "
                        "Always respond with valid JSON only."
                    ),
                },
                {
                    "role": "user",
                    "content": f"""Evaluate this debate.

Topic: "{topic}"

{agent_a_name} argued FOR:
{transcript_a}

---

{agent_b_name} argued AGAINST:
{transcript_b}

---

Return a JSON object with exactly these fields:
{{
  "winner": "a" or "b",
  "winner_name": "<name of winner>",
  "score_a": <integer 1-10>,
  "score_b": <integer 1-10>,
  "reasoning": "<2-3 sentences explaining your decision>",
  "key_points_a": ["<strongest point 1>", "<strongest point 2>", "<strongest point 3>"],
  "key_points_b": ["<strongest point 1>", "<strongest point 2>", "<strongest point 3>"],
  "summary": "<one paragraph recap of the debate>"
}}""",
                },
            ],
            # Forces the model to return valid JSON.
            # The model still decides the structure unless you also pass a schema
            # (via the newer json_schema response_format or .parse() approach).
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        data = json.loads(raw)

        # Pydantic validates types and field presence
        return JudgeVerdict(**data)

        # ── Alternative: newer structured output API (SDK ≥ 1.50) ──────────
        # response = await client.beta.chat.completions.parse(
        #     model="gpt-4o",
        #     messages=[...],
        #     response_format=JudgeVerdict,   # pass the Pydantic model directly
        # )
        # return response.choices[0].message.parsed  # already a JudgeVerdict instance
