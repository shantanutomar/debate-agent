import type { AgentState } from "../types/debate";

interface Props {
  agent: AgentState;
  isCurrentSpeaker: boolean;
  currentRound: number;
}

export function AgentPanel({ agent, isCurrentSpeaker, currentRound }: Props) {
  const isFor = agent.stance === "for";

  return (
    <div
      className={`flex flex-col h-full rounded-2xl border transition-all duration-300
        ${isCurrentSpeaker
          ? "border-indigo-400/60 shadow-lg shadow-indigo-500/10 bg-white/5"
          : "border-white/10 bg-white/[0.03]"
        }`}
    >
      {/* Agent header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm
            ${isFor ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}
        >
          {agent.name[0]}
        </div>
        <div>
          <div className="font-semibold text-white">{agent.name}</div>
          <div className={`text-xs font-medium ${isFor ? "text-emerald-400" : "text-rose-400"}`}>
            {isFor ? "▲ Arguing For" : "▼ Arguing Against"}
          </div>
        </div>
        {isCurrentSpeaker && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs text-indigo-300 font-medium">Speaking</span>
          </div>
        )}
      </div>

      {/* Turns */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {agent.turns.length === 0 && (
          <p className="text-white/20 text-sm text-center mt-8">Waiting to speak…</p>
        )}

        {agent.turns.map((turn, i) => (
          <div key={i} className="space-y-3">
            {/* Round label */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30 font-medium uppercase tracking-wider">
                {turn.round === 1 ? "Opening" : `Round ${turn.round}`}
              </span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            {/* Tool calls — shown as pills above the argument */}
            {turn.toolCalls.length > 0 && (
              <div className="space-y-1.5">
                {turn.toolCalls.map((tc, j) => (
                  <div
                    key={j}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                               bg-amber-500/10 border border-amber-500/20"
                  >
                    <span className="text-amber-400 text-xs">🔍</span>
                    <span className="text-amber-300/80 text-xs font-mono truncate">
                      {tc.query}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Argument text */}
            <p
              className={`text-white/85 text-sm leading-relaxed streaming-text
                ${turn.isStreaming ? "cursor-blink" : ""}`}
            >
              {turn.content || (turn.isStreaming ? "" : "…")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
