"use client";

import { useState } from "react";
import { EpisodeClip } from "@/lib/types";

function buildClipBrief(clip: EpisodeClip) {
  return [
    clip.clipTitle,
    `Segment: ${clip.startSegment} -> ${clip.endSegment}`,
    `Tags: ${clip.tags.join(", ")}`,
    "",
    "Hook line",
    clip.hookLine,
    "",
    "Why it works",
    clip.whyItWorks,
    "",
    "Short caption",
    clip.shortCaption,
  ].join("\n");
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ClipDistributionPanel({
  episodeTitle,
  clips,
}: {
  episodeTitle: string;
  clips: EpisodeClip[];
}) {
  const [feedback, setFeedback] = useState("");

  async function handleCopy(value: string, label: string) {
    try {
      await copyText(value);
      setFeedback(`${label} copied.`);
      window.setTimeout(() => setFeedback(""), 1800);
    } catch {
      setFeedback(`Failed to copy ${label.toLowerCase()}.`);
      window.setTimeout(() => setFeedback(""), 2200);
    }
  }

  return (
    <div className="mt-8 rounded-[1.75rem] border border-ink/8 bg-white/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm uppercase tracking-[0.3em] text-teal">Clips</p>
        {feedback ? <p className="text-xs uppercase tracking-[0.2em] text-coral">{feedback}</p> : null}
      </div>
      <div className="mt-4 space-y-4">
        {clips.map((clip, index) => (
          <article key={clip.id} className="rounded-[1.25rem] border border-ink/8 bg-white/80 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-ink">{clip.clipTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-ink/74">{clip.hookLine}</p>
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-ink/45">
                {clip.startSegment.replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink/62">{clip.whyItWorks}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {clip.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-ink/8 bg-parchment px-3 py-1 text-xs uppercase tracking-[0.2em] text-ink/55"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-4 rounded-[1rem] border border-dashed border-coral/20 bg-coral/5 px-4 py-3 text-sm leading-6 text-ink/70">
              {clip.shortCaption}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCopy(clip.shortCaption, "Caption")}
                className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium text-ink"
              >
                Copy caption
              </button>
              <button
                type="button"
                onClick={() => handleCopy(buildClipBrief(clip), "Clip brief")}
                className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium text-ink"
              >
                Copy brief
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadTextFile(
                    `${episodeTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-clip-${String(index + 1).padStart(2, "0")}.txt`,
                    buildClipBrief(clip),
                  )
                }
                className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-parchment"
              >
                Export clip
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
