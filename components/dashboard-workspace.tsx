"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EpisodeCard } from "@/components/episode-card";
import { Episode, EpisodeStatus } from "@/lib/types";

const statusOptions: Array<{ label: string; value: EpisodeStatus | "all" }> = [
  { label: "All statuses", value: "all" },
  { label: "Script Ready", value: "script_ready" },
  { label: "Audio Ready", value: "audio_ready" },
  { label: "Draft", value: "draft" },
  { label: "Rendering", value: "audio_rendering" },
];

const modeOptions = [
  { label: "All modes", value: "all" },
  { label: "OpenAI", value: "openai" },
  { label: "Fallback", value: "fallback" },
] as const;

function parseDurationMinutes(label: string) {
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function containsQuery(episode: Episode, query: string) {
  const haystack = [
    episode.title,
    episode.summary,
    episode.showName,
    episode.template,
    episode.sourceContent,
    ...episode.showNotes,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export function DashboardWorkspace({
  episodes,
  createdCount = 0,
}: {
  episodes: Episode[];
  createdCount?: number;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<EpisodeStatus | "all">("all");
  const [mode, setMode] = useState<"all" | "openai" | "fallback">("all");

  const filteredEpisodes = useMemo(() => {
    return episodes.filter((episode) => {
      const matchesQuery = query.trim() ? containsQuery(episode, query.trim()) : true;
      const matchesStatus = status === "all" ? true : episode.status === status;
      const matchesMode =
        mode === "all" ? true : (episode.generationMode ?? "fallback") === mode;

      return matchesQuery && matchesStatus && matchesMode;
    });
  }, [episodes, mode, query, status]);

  const metrics = useMemo(() => {
    const audioReadyCount = filteredEpisodes.filter((episode) => episode.status === "audio_ready").length;
    const openAiCount = filteredEpisodes.filter(
      (episode) => (episode.generationMode ?? "fallback") === "openai",
    ).length;
    const avgRuntime = filteredEpisodes.length
      ? Math.round(
          filteredEpisodes.reduce((sum, episode) => sum + parseDurationMinutes(episode.durationLabel), 0) /
            filteredEpisodes.length,
        )
      : 0;

    return [
      { label: "Visible Episodes", value: String(filteredEpisodes.length) },
      { label: "Audio Ready", value: String(audioReadyCount) },
      { label: "OpenAI Drafts", value: String(openAiCount) },
      { label: "Avg. Runtime", value: avgRuntime ? `${avgRuntime} min` : "-" },
    ];
  }, [filteredEpisodes]);

  return (
    <>
      {createdCount > 0 ? (
        <section className="rounded-[1.75rem] border border-teal/18 bg-teal/8 px-5 py-4 text-sm text-teal">
          Batch generation completed. {createdCount} new episode{createdCount > 1 ? "s" : ""} added to the queue.
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="panel rounded-[1.75rem] p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-ink/45">{metric.label}</p>
            <p className="mt-3 font-display text-4xl text-ink">{metric.value}</p>
          </div>
        ))}
      </section>

      <section className="panel rounded-[2rem] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-coral">Filters</p>
            <h2 className="mt-2 font-display text-3xl text-ink">Production queue</h2>
          </div>
          <Link
            href="/episodes/new"
            className="inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-parchment transition hover:-translate-y-0.5"
          >
            Create episode
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_0.7fr_0.7fr]">
          <label className="grid gap-2 text-sm text-ink/68">
            Search
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, summary, notes, or source text"
              className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm text-ink/68">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as EpisodeStatus | "all")}
              className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-ink/68">
            Generation mode
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as "all" | "openai" | "fallback")}
              className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
            >
              {modeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-4">
        {filteredEpisodes.length ? (
          filteredEpisodes.map((episode) => <EpisodeCard key={episode.id} episode={episode} />)
        ) : (
          <div className="panel rounded-[2rem] p-8 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-ink/45">No matches</p>
            <h3 className="mt-3 font-display text-3xl text-ink">Nothing fits the current filters</h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              Clear the search, switch status filters, or create a fresh episode to refill the queue.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
