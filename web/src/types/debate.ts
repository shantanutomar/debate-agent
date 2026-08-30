/**
 * All types shared across the frontend.
 * Mirrors the event dicts yielded by the Python orchestrator.
 */

export type AgentStance = "for" | "against";

// ── SSE event union ──────────────────────────────────────────────────────────
// Every message from the backend is one of these shapes.
// The `type` field is the discriminant — use it in switch statements.

export type DebateEvent =
  | {
      type: "debate_start";
      topic: string;
      agent_a: string;
      agent_b: string;
      rounds: number;
    }
  | { type: "agent_start"; agent: string; stance: AgentStance; round: number }
  | { type: "token"; agent: string; content: string }
  | { type: "tool_call"; agent: string; tool: string; query: string }
  | { type: "tool_result"; agent: string; tool: string }
  | { type: "agent_end"; agent: string; content: string }
  | { type: "judge_start" }
  | { type: "judge_verdict"; verdict: JudgeVerdict }
  | { type: "debate_end" };

// ── Judge verdict ────────────────────────────────────────────────────────────
export interface JudgeVerdict {
  winner: "a" | "b";
  winner_name: string;
  score_a: number;
  score_b: number;
  reasoning: string;
  key_points_a: string[];
  key_points_b: string[];
  summary: string;
}

// ── UI state for a single agent's turn ──────────────────────────────────────
export interface AgentTurn {
  round: number;
  content: string;         // accumulated streaming text
  toolCalls: ToolCallRecord[];
  isStreaming: boolean;
}

export interface ToolCallRecord {
  tool: string;
  query: string;
}

// ── Model options ────────────────────────────────────────────────────────────
export interface ModelOption {
  id: string;
  label: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "gpt-4o",       label: "GPT-4o" },
  { id: "gpt-4o-mini",  label: "GPT-4o mini" },
  { id: "gpt-4-turbo",  label: "GPT-4 Turbo" },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

// ── Config passed from the form into the hook ────────────────────────────────
export interface DebateConfig {
  topic: string;
  apiKey: string;
  model: string;
}

// ── Top-level debate state ───────────────────────────────────────────────────
export type DebateStatus = "idle" | "running" | "judging" | "complete" | "error";

export interface AgentState {
  name: string;
  stance: AgentStance;
  turns: AgentTurn[];
}

export interface DebateState {
  status: DebateStatus;
  topic?: string;
  agentA?: AgentState;
  agentB?: AgentState;
  currentSpeaker?: string;
  currentRound?: number;
  totalRounds?: number;
  verdict?: JudgeVerdict;
  error?: string;
}
