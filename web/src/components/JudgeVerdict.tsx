import type { JudgeVerdict as Verdict } from "../types/debate";

interface Props {
  verdict: Verdict;
  agentAName: string;
  agentBName: string;
  isJudging: boolean;
}

export function JudgeVerdict({ verdict, agentAName, agentBName, isJudging }: Props) {
  if (isJudging) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <div className="flex items-center justify-center gap-3 text-white/60">
          <span className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          <span className="text-sm">Judge is evaluating the debate…</span>
        </div>
      </div>
    );
  }

  const winnerName = verdict.winner_name;
  const winnerIsA = verdict.winner === "a";

  return (
    <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-yellow-500/20 flex items-center gap-3">
        <span className="text-2xl">⚖️</span>
        <div>
          <div className="text-white font-semibold">Judge's Verdict</div>
          <div className="text-white/40 text-xs">Independent evaluation</div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Winner announcement */}
        <div className="text-center py-4">
          <div className="text-white/50 text-sm mb-1">Winner</div>
          <div
            className={`text-3xl font-bold ${
              winnerIsA ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            🏆 {winnerName}
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4">
          <ScoreBar
            name={agentAName}
            score={verdict.score_a}
            isWinner={verdict.winner === "a"}
            color="emerald"
          />
          <ScoreBar
            name={agentBName}
            score={verdict.score_b}
            isWinner={verdict.winner === "b"}
            color="rose"
          />
        </div>

        {/* Reasoning */}
        <div className="space-y-2">
          <div className="text-white/50 text-xs uppercase tracking-wider font-medium">
            Reasoning
          </div>
          <p className="text-white/75 text-sm leading-relaxed">{verdict.reasoning}</p>
        </div>

        {/* Key points */}
        <div className="grid grid-cols-2 gap-6">
          <KeyPoints name={agentAName} points={verdict.key_points_a} color="emerald" />
          <KeyPoints name={agentBName} points={verdict.key_points_b} color="rose" />
        </div>

        {/* Summary */}
        <div className="space-y-2 pt-4 border-t border-white/10">
          <div className="text-white/50 text-xs uppercase tracking-wider font-medium">
            Summary
          </div>
          <p className="text-white/60 text-sm leading-relaxed italic">"{verdict.summary}"</p>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({
  name,
  score,
  isWinner,
  color,
}: {
  name: string;
  score: number;
  isWinner: boolean;
  color: "emerald" | "rose";
}) {
  const barColor = color === "emerald" ? "bg-emerald-500" : "bg-rose-500";
  const textColor = color === "emerald" ? "text-emerald-400" : "text-rose-400";

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className={`text-sm font-medium ${textColor} flex items-center gap-1`}>
          {isWinner && <span>🏆</span>} {name}
        </span>
        <span className="text-white font-bold">{score}/10</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-700`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
    </div>
  );
}

function KeyPoints({
  name,
  points,
  color,
}: {
  name: string;
  points: string[];
  color: "emerald" | "rose";
}) {
  const textColor = color === "emerald" ? "text-emerald-400" : "text-rose-400";
  const dotColor = color === "emerald" ? "bg-emerald-400" : "bg-rose-400";

  return (
    <div className="space-y-2">
      <div className={`text-xs font-medium ${textColor} uppercase tracking-wider`}>
        {name}'s strengths
      </div>
      <ul className="space-y-1.5">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-white/60">
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-1.5 shrink-0`} />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
