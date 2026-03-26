"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Episode, PublishingPlatform } from "@/lib/types";

const platformOptions: Array<{ label: string; value: PublishingPlatform | "" }> = [
  { label: "Not set", value: "" },
  { label: "Spotify", value: "spotify" },
  { label: "Apple Podcasts", value: "apple-podcasts" },
  { label: "Xiaoyuzhou", value: "xiaoyuzhou" },
  { label: "YouTube", value: "youtube" },
  { label: "RSS", value: "rss" },
  { label: "Other", value: "other" },
];

function parseNumericInput(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function deriveCtr(impressions: number, clicks: number) {
  if (!impressions) {
    return 0;
  }

  return Math.round((clicks / impressions) * 1000) / 10;
}

export function EpisodeAnalyticsPanel({ episode }: { episode: Episode }) {
  const router = useRouter();
  const analytics = episode.analytics;
  const [publishingPlatform, setPublishingPlatform] = useState<PublishingPlatform | "">(
    analytics?.publishingPlatform ?? "",
  );
  const [selectedTitleStyle, setSelectedTitleStyle] = useState(analytics?.selectedTitleStyle ?? "");
  const [impressions, setImpressions] = useState(String(analytics?.metrics.impressions ?? 0));
  const [clicks, setClicks] = useState(String(analytics?.metrics.clicks ?? 0));
  const [listens, setListens] = useState(String(analytics?.metrics.listens ?? 0));
  const [completionRate, setCompletionRate] = useState(String(analytics?.metrics.completionRate ?? 0));
  const [saves, setSaves] = useState(String(analytics?.metrics.saves ?? 0));
  const [shares, setShares] = useState(String(analytics?.metrics.shares ?? 0));
  const [bestPerformingClipId, setBestPerformingClipId] = useState(
    analytics?.metrics.bestPerformingClipId ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  async function handleSave() {
    setIsSaving(true);
    setError("");
    setFeedback("");

    try {
      const response = await fetch(`/api/episodes/${episode.id}/analytics`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          publishingPlatform: publishingPlatform || undefined,
          selectedTitleStyle: selectedTitleStyle || undefined,
          metrics: {
            impressions: parseNumericInput(impressions),
            clicks: parseNumericInput(clicks),
            listens: parseNumericInput(listens),
            completionRate: parseNumericInput(completionRate),
            saves: parseNumericInput(saves),
            shares: parseNumericInput(shares),
            bestPerformingClipId: bestPerformingClipId || undefined,
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to save analytics.");
      }

      setFeedback("Analytics saved.");
      router.refresh();
      window.setTimeout(() => setFeedback(""), 1800);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save analytics.");
      window.setTimeout(() => setError(""), 2200);
    } finally {
      setIsSaving(false);
    }
  }

  const ctr = deriveCtr(parseNumericInput(impressions), parseNumericInput(clicks));

  return (
    <div className="mt-8 rounded-[1.75rem] border border-ink/8 bg-white/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-coral">Episode Analytics</p>
          <p className="mt-2 text-sm leading-6 text-ink/68">
            Log platform, title style, and performance so the studio can learn what actually wins.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-parchment disabled:opacity-70"
        >
          {isSaving ? "Saving..." : "Save analytics"}
        </button>
      </div>

      {feedback ? (
        <p className="mt-4 rounded-[1rem] border border-teal/20 bg-teal/10 px-4 py-3 text-sm text-teal">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-[1rem] border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <label className="grid gap-2 text-sm text-ink/70">
          Publishing platform
          <select
            value={publishingPlatform}
            onChange={(event) => setPublishingPlatform(event.target.value as PublishingPlatform | "")}
            className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
          >
            {platformOptions.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm text-ink/70">
          Title style used
          <select
            value={selectedTitleStyle}
            onChange={(event) => setSelectedTitleStyle(event.target.value)}
            className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
          >
            <option value="">Not set</option>
            {episode.variants?.titles.map((variant) => (
              <option key={variant.id} value={variant.style}>
                {variant.style}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-2 text-sm text-ink/70">
          Impressions
          <input value={impressions} onChange={(event) => setImpressions(event.target.value)} className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
        </label>
        <label className="grid gap-2 text-sm text-ink/70">
          Clicks
          <input value={clicks} onChange={(event) => setClicks(event.target.value)} className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
        </label>
        <label className="grid gap-2 text-sm text-ink/70">
          Listens
          <input value={listens} onChange={(event) => setListens(event.target.value)} className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
        </label>
        <label className="grid gap-2 text-sm text-ink/70">
          Completion rate (%)
          <input value={completionRate} onChange={(event) => setCompletionRate(event.target.value)} className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
        </label>
        <label className="grid gap-2 text-sm text-ink/70">
          Saves
          <input value={saves} onChange={(event) => setSaves(event.target.value)} className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
        </label>
        <label className="grid gap-2 text-sm text-ink/70">
          Shares
          <input value={shares} onChange={(event) => setShares(event.target.value)} className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
        </label>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.6fr]">
        <label className="grid gap-2 text-sm text-ink/70">
          Best-performing clip
          <select
            value={bestPerformingClipId}
            onChange={(event) => setBestPerformingClipId(event.target.value)}
            className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
          >
            <option value="">Not set</option>
            {episode.clips?.map((clip) => (
              <option key={clip.id} value={clip.id}>
                {clip.clipTitle}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-[1.25rem] border border-dashed border-teal/20 bg-teal/5 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-teal">Quick Read</p>
          <div className="mt-3 space-y-2 text-sm text-ink/72">
            <p>Host pair: {analytics?.hostPair ?? `${episode.hostA.name} + ${episode.hostB.name}`}</p>
            <p>Conflict: {analytics?.conflictLevel ?? "medium"}</p>
            <p>Clip lines: {analytics?.numberOfClipLines ?? 0}</p>
            <p>CTR: {ctr}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
