import { ScriptTurn } from "@/lib/types";

export function ScriptPreview({ turns }: { turns: ScriptTurn[] }) {
  return (
    <div className="space-y-4">
      {turns.map((turn) => (
        <div
          key={turn.id}
          className={`rounded-[1.5rem] border px-4 py-3 ${
            turn.speaker === "A"
              ? "border-teal/20 bg-teal/5"
              : "border-coral/20 bg-coral/5"
          }`}
        >
          <p className="text-xs uppercase tracking-[0.25em] text-ink/45">Host {turn.speaker}</p>
          <p className="mt-2 text-sm leading-6 text-ink">{turn.text}</p>
        </div>
      ))}
    </div>
  );
}
