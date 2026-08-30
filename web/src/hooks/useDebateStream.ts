/**
 * useDebateStream
 * ===============
 * Custom hook that manages the SSE connection to the backend.
 *
 * Why not use the browser's EventSource API?
 * EventSource only supports GET requests. Our endpoint is POST (we send a body).
 * Instead we use fetch() + ReadableStream, which gives us the same streaming
 * behaviour with full control over the request.
 *
 * Flow:
 *   1. POST /api/debate/stream with the topic
 *   2. Read the response body as a stream, chunk by chunk
 *   3. Decode each chunk into SSE lines ("data: {...}\n\n")
 *   4. Parse the JSON and update React state via processEvent()
 */

import { useCallback, useRef, useState } from "react";
import type {
  AgentTurn,
  DebateConfig,
  DebateEvent,
  DebateState,
  ToolCallRecord,
} from "../types/debate";

// In development this falls back to localhost.
// Set VITE_API_URL in Vercel dashboard to your Railway backend URL.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const INITIAL_STATE: DebateState = { status: "idle" };

export function useDebateStream() {
  const [state, setState] = useState<DebateState>(INITIAL_STATE);
  // Keep a ref to the stream reader so we can cancel it on reset
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // ── processEvent: translate each backend event into a state update ─────────
  // Using a function (not an inline setState callback) keeps the switch readable.
  function processEvent(event: DebateEvent) {
    setState((prev) => {
      switch (event.type) {
        // ── Debate initialised ───────────────────────────────────────────
        case "debate_start":
          return {
            ...prev,
            topic: event.topic,
            totalRounds: event.rounds,
            agentA: { name: event.agent_a, stance: "for", turns: [] },
            agentB: { name: event.agent_b, stance: "against", turns: [] },
          };

        // ── An agent starts a new turn ───────────────────────────────────
        case "agent_start": {
          const newTurn: AgentTurn = {
            round: event.round,
            content: "",
            toolCalls: [],
            isStreaming: true,
          };
          const isA = prev.agentA?.name === event.agent;
          return {
            ...prev,
            currentSpeaker: event.agent,
            currentRound: event.round,
            agentA: isA
              ? { ...prev.agentA!, turns: [...prev.agentA!.turns, newTurn] }
              : prev.agentA,
            agentB: !isA
              ? { ...prev.agentB!, turns: [...prev.agentB!.turns, newTurn] }
              : prev.agentB,
          };
        }

        // ── A token arrives: append to the last turn ─────────────────────
        case "token": {
          const isA = prev.agentA?.name === event.agent;
          const appendToken = (turns: AgentTurn[]): AgentTurn[] => {
            const last = turns[turns.length - 1];
            return [
              ...turns.slice(0, -1),
              { ...last, content: last.content + event.content },
            ];
          };
          return {
            ...prev,
            agentA: isA
              ? { ...prev.agentA!, turns: appendToken(prev.agentA!.turns) }
              : prev.agentA,
            agentB: !isA
              ? { ...prev.agentB!, turns: appendToken(prev.agentB!.turns) }
              : prev.agentB,
          };
        }

        // ── Agent called a tool ──────────────────────────────────────────
        case "tool_call": {
          const isA = prev.agentA?.name === event.agent;
          const record: ToolCallRecord = { tool: event.tool, query: event.query };
          const addToolCall = (turns: AgentTurn[]): AgentTurn[] => {
            const last = turns[turns.length - 1];
            return [
              ...turns.slice(0, -1),
              { ...last, toolCalls: [...last.toolCalls, record] },
            ];
          };
          return {
            ...prev,
            agentA: isA
              ? { ...prev.agentA!, turns: addToolCall(prev.agentA!.turns) }
              : prev.agentA,
            agentB: !isA
              ? { ...prev.agentB!, turns: addToolCall(prev.agentB!.turns) }
              : prev.agentB,
          };
        }

        // ── Agent finished speaking ──────────────────────────────────────
        case "agent_end": {
          const isA = prev.agentA?.name === event.agent;
          const stopStreaming = (turns: AgentTurn[]): AgentTurn[] => {
            const last = turns[turns.length - 1];
            return [...turns.slice(0, -1), { ...last, isStreaming: false }];
          };
          return {
            ...prev,
            currentSpeaker: undefined,
            agentA: isA
              ? { ...prev.agentA!, turns: stopStreaming(prev.agentA!.turns) }
              : prev.agentA,
            agentB: !isA
              ? { ...prev.agentB!, turns: stopStreaming(prev.agentB!.turns) }
              : prev.agentB,
          };
        }

        case "judge_start":
          return { ...prev, status: "judging" };

        case "judge_verdict":
          return { ...prev, verdict: event.verdict };

        case "debate_end":
          return { ...prev, status: "complete" };

        default:
          return prev;
      }
    });
  }

  // ── startDebate: open the SSE stream ──────────────────────────────────────
  const startDebate = useCallback(async ({ topic, apiKey, model }: DebateConfig) => {
    // Cancel any existing stream before starting a new one
    readerRef.current?.cancel();
    setState({ ...INITIAL_STATE, status: "running", topic });

    try {
      const response = await fetch(`${API_URL}/api/debate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, rounds: 2, api_key: apiKey, model }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";

      // Read chunks until the stream closes
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the binary chunk and add to buffer
        // `stream: true` handles multi-byte characters split across chunks
        buffer += decoder.decode(value, { stream: true });

        // SSE messages are separated by double newlines
        // Process complete messages and keep any partial one in the buffer
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? ""; // last part may be incomplete

        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") return; // stream finished
            try {
              const event = JSON.parse(raw) as DebateEvent;
              processEvent(event);
            } catch {
              // Skip malformed JSON — shouldn't happen but be defensive
            }
          }
        }
      }
    } catch (err) {
      setState((prev) => ({ ...prev, status: "error", error: String(err) }));
    }
  }, []);

  const reset = useCallback(() => {
    readerRef.current?.cancel();
    setState(INITIAL_STATE);
  }, []);

  return { state, startDebate, reset };
}
