"""
Debate Orchestrator
===================
The orchestrator owns the debate flow. It:
  - Creates the two debater agents and the judge
  - Runs the debate round-by-round
  - Yields a flat stream of events that the FastAPI route forwards as SSE

This is the "conductor" pattern in multi-agent systems:
one coordinator that manages multiple specialised agents.

All events are plain dicts → JSON-serialisable → sent as SSE data frames.

Event catalogue (frontend should handle all of these):
  debate_start   — metadata about the debate
  agent_start    — an agent is about to speak
  token          — a streaming text chunk from that agent
  tool_call      — agent is searching (show indicator)
  tool_result    — search done (hide indicator)
  agent_end      — agent finished speaking
  judge_start    — judge is evaluating
  judge_verdict  — structured verdict object
  debate_end     — everything is done
"""

import asyncio
from typing import AsyncGenerator

from agents.debater import DebaterAgent
from agents.judge import JudgeAgent


class DebateOrchestrator:
    def __init__(self, topic: str, api_key: str, model: str = "gpt-4o", rounds: int = 2):
        self.topic = topic
        self.rounds = rounds

        # Two agents with opposing stances — both use the same user-supplied key + model
        self.agent_a = DebaterAgent(name="Axiom", stance="for", api_key=api_key, model=model)
        self.agent_b = DebaterAgent(name="Nexus", stance="against", api_key=api_key, model=model)
        self.judge = JudgeAgent(api_key=api_key, model=model)

    async def run(self) -> AsyncGenerator[dict, None]:
        """
        Drive the full debate and yield every event.
        The FastAPI route consumes this generator and wraps each event as SSE.
        """

        # ── Announce the debate ────────────────────────────────────────────
        yield {
            "type": "debate_start",
            "topic": self.topic,
            "agent_a": self.agent_a.name,
            "agent_b": self.agent_b.name,
            "rounds": self.rounds,
        }

        # Track each agent's last full argument so the other can rebut it
        last_a_content = ""
        last_b_content = ""

        # ── Debate rounds ──────────────────────────────────────────────────
        for round_num in range(1, self.rounds + 1):

            # ── Agent A speaks ─────────────────────────────────────────────
            yield {
                "type": "agent_start",
                "agent": self.agent_a.name,
                "stance": "for",
                "round": round_num,
            }

            async for event in self.agent_a.argue(
                topic=self.topic,
                opponent_argument=last_b_content,
                round_num=round_num,
            ):
                if event["type"] == "agent_end":
                    last_a_content = event["content"]
                yield event

            await asyncio.sleep(0.3)  # brief pause — gives the UI a moment to render

            # ── Agent B speaks ─────────────────────────────────────────────
            yield {
                "type": "agent_start",
                "agent": self.agent_b.name,
                "stance": "against",
                "round": round_num,
            }

            async for event in self.agent_b.argue(
                topic=self.topic,
                opponent_argument=last_a_content,
                round_num=round_num,
            ):
                if event["type"] == "agent_end":
                    last_b_content = event["content"]
                yield event

            await asyncio.sleep(0.3)

        # ── Judge evaluates ────────────────────────────────────────────────
        yield {"type": "judge_start"}

        verdict = await self.judge.evaluate(
            topic=self.topic,
            agent_a_name=self.agent_a.name,
            agent_b_name=self.agent_b.name,
            transcript_a=self.agent_a.full_transcript(),
            transcript_b=self.agent_b.full_transcript(),
        )

        yield {
            "type": "judge_verdict",
            "verdict": verdict.model_dump(),
        }

        yield {"type": "debate_end"}
