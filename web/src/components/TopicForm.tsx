import { type FormEvent, useEffect, useState } from "react";
import { MODEL_OPTIONS } from "../types/debate";
import type { DebateConfig } from "../types/debate";

const EXAMPLE_TOPICS = [
  "TypeScript is better than JavaScript",
  "Remote work is more productive than in-office",
  "AI will replace software engineers",
  "REST is better than GraphQL",
  "Functional programming is better than OOP",
];

const LS_API_KEY = "debate_agent_openai_key";
const LS_MODEL   = "debate_agent_model";

interface Props {
  onStart: (config: DebateConfig) => void;
  disabled?: boolean;
}

export function TopicForm({ onStart, disabled }: Props) {
  const [topic,  setTopic]  = useState("");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(LS_API_KEY) ?? "");
  const [model,  setModel]  = useState(() => localStorage.getItem(LS_MODEL)   ?? "gpt-4o");
  const [showKey, setShowKey] = useState(false);

  // Persist to localStorage whenever they change
  useEffect(() => { localStorage.setItem(LS_API_KEY, apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem(LS_MODEL, model); },   [model]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = topic.trim();
    if (trimmed) onStart({ topic: trimmed, apiKey, model });
  }

  function startExample(t: string) {
    setTopic(t);
    onStart({ topic: t, apiKey, model });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* ── API key row ──────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-sm font-medium">OpenAI API key</span>
          <span className="text-white/30 text-xs">Stored locally — never sent anywhere else</span>
        </div>

        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            disabled={disabled}
            className="w-full px-4 py-2.5 pr-24 rounded-lg bg-white/10 border border-white/15
                       text-white placeholder-white/30 text-sm font-mono
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2
                       text-white/40 hover:text-white/70 text-xs transition-colors"
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>

        {/* ── Model picker ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-sm shrink-0">Model</span>
          <div className="flex flex-wrap gap-2">
            {MODEL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => setModel(opt.id)}
                className={[
                  "px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150",
                  "disabled:opacity-30 disabled:cursor-not-allowed",
                  model === opt.id
                    ? "bg-indigo-500/30 border-indigo-400 text-indigo-200"
                    : "bg-white/5 border-white/15 text-white/50 hover:text-white hover:border-white/30",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Topic + submit ───────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a debate topic…"
          disabled={disabled}
          className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20
                     text-white placeholder-white/40 text-lg
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <button
          type="submit"
          disabled={disabled || !topic.trim()}
          className="py-4 px-8 rounded-xl font-semibold text-lg
                     bg-indigo-500 hover:bg-indigo-400 text-white
                     transition-all duration-200
                     disabled:opacity-40 disabled:cursor-not-allowed
                     shadow-lg shadow-indigo-500/20"
        >
          Start Debate
        </button>
      </form>

      {/* ── Example topics ───────────────────────────────────────────── */}
      <div>
        <p className="text-white/40 text-sm mb-3 text-center">Try an example</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {EXAMPLE_TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              disabled={disabled}
              onClick={() => startExample(t)}
              className="px-3 py-1.5 rounded-full text-sm
                         bg-white/5 hover:bg-white/15 text-white/60 hover:text-white
                         border border-white/10 hover:border-white/30
                         transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
