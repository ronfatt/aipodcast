import Link from "next/link";
import { Episode } from "@/lib/types";

const statusLabel: Record<Episode["status"], string> = {
  draft: "Draft",
  script_ready: "Script Ready",
  audio_rendering: "Rendering",
  audio_ready: "Audio Ready",
};

export function EpisodeCard({ episode }: { episode: Episode }) {
  const generationMode = episode.generationMode ?? "fallback";

  return (
    <article className="panel rounded-[1.75rem] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ink/45">{episode.showName}</p>
          <h3 className="mt-2 text-xl font-semibold text-ink">{episode.title}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink/72">{episode.summary}</p>
        </div>
        <span className="rounded-full bg-coral px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
          {statusLabel[episode.status]}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-ink/60">
        <span>{episode.durationLabel}</span>
        <span>{generationMode}</span>
        <span>{episode.template}</span>
        <span>{episode.hostA.name}</span>
        <span>{episode.hostB.name}</span>
        <span>{episode.updatedAt}</span>
      </div>
      <div className="mt-6">
        <Link
          href={`/episodes/${episode.id}`}
          className="inline-flex rounded-full border border-ink/10 bg-ink px-4 py-2 text-sm font-medium text-parchment transition hover:-translate-y-0.5"
        >
          Open episode
        </Link>
      </div>
    </article>
  );
}
