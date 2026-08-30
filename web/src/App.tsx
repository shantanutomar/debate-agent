import { AgentPanel } from "./components/AgentPanel";
import { JudgeVerdict } from "./components/JudgeVerdict";
import { TopicForm } from "./components/TopicForm";
import { useDebateStream } from "./hooks/useDebateStream";

export default function App() {
  const { state, startDebate, reset } = useDebateStream();
  const { status, topic, agentA, agentB, currentSpeaker, currentRound, totalRounds, verdict } =
    state;

  const isDebating = status === "running" || status === "judging";
  const showArena = status !== "idle";
  const showVerdict = status === "complete" || status === "judging";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-950/40 via-gray-950 to-gray-950 pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-10 space-y-10">

        {/* Header */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            ⚔️ <span className="text-indigo-400">Debate</span> Arena
          </h1>
          <p className="text-white/40 text-sm">
            Two AI agents argue opposite sides — a judge decides the winner
          </p>
        </header>

        {/* Topic form — always visible at top */}
        {!isDebating && (
          <TopicForm onStart={startDebate} disabled={isDebating} />
        )}


        {/* Active topic + reset */}
        {showArena && topic && (
          <div className="flex items-center justify-between gap-4 px-5 py-3
                          rounded-xl bg-white/5 border border-white/10">
            <div>
              <span className="text-white/40 text-xs uppercase tracking-wider mr-2">Topic</span>
              <span className="text-white font-medium">{topic}</span>
            </div>
            <div className="flex items-center gap-3">
              {isDebating && currentRound && totalRounds && (
                <span className="text-white/40 text-sm">
                  Round {currentRound} / {totalRounds}
                </span>
              )}
              {!isDebating && (
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-1.5 rounded-lg text-sm text-white/60 hover:text-white
                             bg-white/5 hover:bg-white/10 border border-white/10
                             transition-all duration-150"
                >
                  New debate
                </button>
              )}
            </div>
          </div>
        )}

        {/* Debate arena — two-column agent panels */}
        {showArena && agentA && agentB && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ minHeight: "500px" }}>
            <AgentPanel
              agent={agentA}
              isCurrentSpeaker={currentSpeaker === agentA.name}
              currentRound={currentRound ?? 0}
            />
            <AgentPanel
              agent={agentB}
              isCurrentSpeaker={currentSpeaker === agentB.name}
              currentRound={currentRound ?? 0}
            />
          </div>
        )}

        {/* Judge section */}
        {showVerdict && agentA && agentB && (
          <div>
            {status === "judging" && !verdict ? (
              <JudgeVerdict
                verdict={{} as never}
                agentAName={agentA.name}
                agentBName={agentB.name}
                isJudging
              />
            ) : verdict ? (
              <JudgeVerdict
                verdict={verdict}
                agentAName={agentA.name}
                agentBName={agentB.name}
                isJudging={false}
              />
            ) : null}
          </div>
        )}

        {/* Error state */}
        {status === "error" && state.error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-center">
            <p className="text-red-400 text-sm mb-3">{state.error}</p>
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 rounded-lg text-sm bg-red-500/20 hover:bg-red-500/30
                         text-red-300 border border-red-500/30 transition-all duration-150"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
