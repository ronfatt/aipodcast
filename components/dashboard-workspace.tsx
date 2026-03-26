"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EpisodeCard } from "@/components/episode-card";
import { OptimizationRecommendationsPanel } from "@/components/optimization-recommendations-panel";
import { buildWorkspaceRecommendations } from "@/lib/optimization-recommender";
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

const rankingWindowOptions = [
  { label: "Last 7d", value: "7d" },
  { label: "Last 30d", value: "30d" },
  { label: "All time", value: "all" },
] as const;

const rankingSortOptions = [
  { label: "Blended", value: "blended" },
  { label: "Listens", value: "listens" },
  { label: "Completion", value: "completion" },
  { label: "Shares", value: "shares" },
] as const;

function parseDurationMinutes(label: string) {
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function deriveCtr(impressions: number, clicks: number) {
  if (!impressions) {
    return 0;
  }

  return Math.round((clicks / impressions) * 1000) / 10;
}

function derivePerformanceScore(
  episode: Episode,
  sortMode: (typeof rankingSortOptions)[number]["value"] = "blended",
) {
  const metrics = episode.analytics?.metrics;

  if (!metrics) {
    return 0;
  }

  if (sortMode === "listens") {
    return metrics.listens;
  }

  if (sortMode === "completion") {
    return Math.round(metrics.completionRate * 10);
  }

  if (sortMode === "shares") {
    return metrics.shares;
  }

  return (
    metrics.listens +
    metrics.shares * 8 +
    metrics.saves * 5 +
    Math.round(metrics.completionRate * 1.5)
  );
}

function parseEpisodeTimestamp(value: string) {
  const parsed = Date.parse(value);

  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  const normalized = value
    .replace(/\//g, "-")
    .replace(" ", "T");
  const normalizedParsed = Date.parse(normalized);
  return Number.isNaN(normalizedParsed) ? 0 : normalizedParsed;
}

function filterEpisodesByWindow(
  episodes: Episode[],
  window: (typeof rankingWindowOptions)[number]["value"],
) {
  if (window === "all") {
    return episodes;
  }

  const now = Date.now();
  const days = window === "7d" ? 7 : 30;
  const threshold = now - days * 24 * 60 * 60 * 1000;

  return episodes.filter((episode) => parseEpisodeTimestamp(episode.updatedAt) >= threshold);
}

function buildTopRankings(
  episodes: Episode[],
  sortMode: (typeof rankingSortOptions)[number]["value"],
) {
  const buckets = {
    topics: new Map<string, number>(),
    hostPairs: new Map<string, number>(),
    conflictLevels: new Map<string, number>(),
    recommendations: new Map<string, number>(),
  };

  episodes.forEach((episode) => {
    const score = derivePerformanceScore(episode, sortMode);
    const hostPair = episode.analytics?.hostPair;
    const conflictLevel = episode.analytics?.conflictLevel;
    const recommendation = episode.appliedRecommendation?.title;

    if (episode.title) {
      buckets.topics.set(episode.title, (buckets.topics.get(episode.title) ?? 0) + score);
    }

    if (hostPair) {
      buckets.hostPairs.set(hostPair, (buckets.hostPairs.get(hostPair) ?? 0) + score);
    }

    if (conflictLevel) {
      buckets.conflictLevels.set(
        conflictLevel,
        (buckets.conflictLevels.get(conflictLevel) ?? 0) + score,
      );
    }

    if (recommendation) {
      buckets.recommendations.set(
        recommendation,
        (buckets.recommendations.get(recommendation) ?? 0) + score,
      );
    }
  });

  const topEntries = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, score]) => ({ label, score }));

  return {
    topics: topEntries(buckets.topics),
    hostPairs: topEntries(buckets.hostPairs),
    conflictLevels: topEntries(buckets.conflictLevels),
    recommendations: topEntries(buckets.recommendations),
  };
}

function buildRecommendationEffectiveness(episodes: Episode[]) {
  const recommendationStats = new Map<
    string,
    {
      count: number;
      totalListens: number;
      totalCompletion: number;
      totalShares: number;
      totalScore: number;
    }
  >();

  episodes.forEach((episode) => {
    const recommendation = episode.appliedRecommendation?.title;
    const metrics = episode.analytics?.metrics;

    if (!recommendation || !metrics) {
      return;
    }

    const current = recommendationStats.get(recommendation) ?? {
      count: 0,
      totalListens: 0,
      totalCompletion: 0,
      totalShares: 0,
      totalScore: 0,
    };

    current.count += 1;
    current.totalListens += metrics.listens;
    current.totalCompletion += metrics.completionRate;
    current.totalShares += metrics.shares;
    current.totalScore += derivePerformanceScore(episode, "blended");
    recommendationStats.set(recommendation, current);
  });

  return [...recommendationStats.entries()]
    .map(([label, stats]) => ({
      label,
      count: stats.count,
      avgListens: Math.round(stats.totalListens / stats.count),
      avgCompletion: Math.round((stats.totalCompletion / stats.count) * 10) / 10,
      avgShares: Math.round((stats.totalShares / stats.count) * 10) / 10,
      avgScore: Math.round(stats.totalScore / stats.count),
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5);
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
  const [rankingWindow, setRankingWindow] = useState<(typeof rankingWindowOptions)[number]["value"]>("7d");
  const [rankingSort, setRankingSort] = useState<(typeof rankingSortOptions)[number]["value"]>("blended");

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
    const totalListens = filteredEpisodes.reduce(
      (sum, episode) => sum + (episode.analytics?.metrics.listens ?? 0),
      0,
    );
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
      { label: "Logged Listens", value: String(totalListens) },
      { label: "Avg. Runtime", value: avgRuntime ? `${avgRuntime} min` : "-" },
    ];
  }, [filteredEpisodes]);

  const performanceSummary = useMemo(() => {
    const withAnalytics = filteredEpisodes.filter((episode) => episode.analytics);

    if (!withAnalytics.length) {
      return undefined;
    }

    const avgCompletion =
      Math.round(
        (withAnalytics.reduce(
          (sum, episode) => sum + (episode.analytics?.metrics.completionRate ?? 0),
          0,
        ) /
          withAnalytics.length) *
          10,
      ) / 10;
    const totalImpressions = withAnalytics.reduce(
      (sum, episode) => sum + (episode.analytics?.metrics.impressions ?? 0),
      0,
    );
    const totalClicks = withAnalytics.reduce(
      (sum, episode) => sum + (episode.analytics?.metrics.clicks ?? 0),
      0,
    );
    const ctr = deriveCtr(totalImpressions, totalClicks);

    const titleStyleTotals = new Map<string, number>();
    const platformTotals = new Map<string, number>();
    const recommendationTotals = new Map<string, number>();

    withAnalytics.forEach((episode) => {
      const titleStyle = episode.analytics?.selectedTitleStyle;
      const platform = episode.analytics?.publishingPlatform;
      const listens = episode.analytics?.metrics.listens ?? 0;
      const recommendation = episode.appliedRecommendation?.title;

      if (titleStyle) {
        titleStyleTotals.set(titleStyle, (titleStyleTotals.get(titleStyle) ?? 0) + listens);
      }

      if (platform) {
        platformTotals.set(platform, (platformTotals.get(platform) ?? 0) + listens);
      }

      if (recommendation) {
        recommendationTotals.set(
          recommendation,
          (recommendationTotals.get(recommendation) ?? 0) + listens,
        );
      }
    });

    const bestTitleStyle =
      [...titleStyleTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
    const bestPlatform =
      [...platformTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
    const bestRecommendation =
      [...recommendationTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

    return {
      avgCompletion,
      ctr,
      bestTitleStyle,
      bestPlatform,
      bestRecommendation,
    };
  }, [filteredEpisodes]);
  const workspaceRecommendations = useMemo(
    () => buildWorkspaceRecommendations(filteredEpisodes),
    [filteredEpisodes],
  );
  const rankingEpisodes = useMemo(
    () => filterEpisodesByWindow(filteredEpisodes, rankingWindow),
    [filteredEpisodes, rankingWindow],
  );
  const rankings = useMemo(() => buildTopRankings(rankingEpisodes, rankingSort), [rankingEpisodes, rankingSort]);
  const recommendationEffectiveness = useMemo(
    () => buildRecommendationEffectiveness(rankingEpisodes),
    [rankingEpisodes],
  );

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

      {performanceSummary ? (
        <section className="panel rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-teal">Performance Signals</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Avg Completion", value: `${performanceSummary.avgCompletion}%` },
              { label: "CTR", value: `${performanceSummary.ctr}%` },
              { label: "Best Title Style", value: performanceSummary.bestTitleStyle },
              { label: "Best Platform", value: performanceSummary.bestPlatform },
            ].map((metric) => (
              <div key={metric.label} className="rounded-[1.5rem] border border-ink/8 bg-white/70 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-ink/45">{metric.label}</p>
                <p className="mt-3 text-xl font-semibold text-ink">{metric.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[1.5rem] border border-dashed border-coral/20 bg-coral/5 px-5 py-4 text-sm text-ink/72">
            Best recommendation lineage: {performanceSummary.bestRecommendation}
          </div>
        </section>
      ) : null}

      <OptimizationRecommendationsPanel
        title="What the studio should improve next"
        kicker="Studio Recommender"
        recommendations={workspaceRecommendations}
      />

      <section className="panel rounded-[2rem] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-coral">Leaderboards</p>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Switch between blended score, listens, completion, or shares to see what is winning from different angles.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-ink/68">
              Time window
              <select
                value={rankingWindow}
                onChange={(event) =>
                  setRankingWindow(event.target.value as (typeof rankingWindowOptions)[number]["value"])
                }
                className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              >
                {rankingWindowOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-ink/68">
              Ranking mode
              <select
                value={rankingSort}
                onChange={(event) =>
                  setRankingSort(event.target.value as (typeof rankingSortOptions)[number]["value"])
                }
                className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              >
                {rankingSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {[
            { label: "Best Topics", items: rankings.topics },
            { label: "Best Host Pairs", items: rankings.hostPairs },
            { label: "Best Conflict Levels", items: rankings.conflictLevels },
            { label: "Best Recommendation Lineage", items: rankings.recommendations },
          ].map((group) => (
            <div key={group.label} className="rounded-[1.5rem] border border-ink/8 bg-white/75 p-5">
              <h3 className="text-base font-semibold text-ink">{group.label}</h3>
              <div className="mt-4 space-y-3">
                {group.items.length ? (
                  group.items.map((item, index) => (
                    <div key={`${group.label}-${item.label}`} className="flex items-start justify-between gap-4 rounded-[1rem] border border-ink/8 bg-parchment px-4 py-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink/45">#{index + 1}</p>
                        <p className="mt-1 text-sm leading-6 text-ink/74">{item.label}</p>
                      </div>
                      <span className="text-sm font-semibold text-ink">{item.score}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-ink/60">Log more analytics to populate this ranking.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel rounded-[2rem] p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-teal">Recommendation Effectiveness</p>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              See which recommendations lead to better average performance after they are actually used.
            </p>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink/45">
            Window: {rankingWindowOptions.find((option) => option.value === rankingWindow)?.label}
          </p>
        </div>
        <div className="mt-5 space-y-3">
          {recommendationEffectiveness.length ? (
            recommendationEffectiveness.map((item, index) => (
              <div
                key={item.label}
                className="rounded-[1.25rem] border border-ink/8 bg-white/75 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/45">#{index + 1}</p>
                    <h3 className="mt-1 text-base font-semibold text-ink">{item.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink/62">
                      Used {item.count} time{item.count > 1 ? "s" : ""} in the selected window.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      { label: "Avg Score", value: item.avgScore },
                      { label: "Avg Listens", value: item.avgListens },
                      { label: "Avg Completion", value: `${item.avgCompletion}%` },
                      { label: "Avg Shares", value: item.avgShares },
                    ].map((metric) => (
                      <div
                        key={`${item.label}-${metric.label}`}
                        className="rounded-[1rem] border border-ink/8 bg-parchment px-4 py-3"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-ink/45">{metric.label}</p>
                        <p className="mt-2 text-sm font-semibold text-ink">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.25rem] border border-ink/8 bg-white/75 px-5 py-4 text-sm leading-6 text-ink/60">
              Use recommendation buttons to create a few follow-up episodes, then this panel will show which advice is actually paying off.
            </div>
          )}
        </div>
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
