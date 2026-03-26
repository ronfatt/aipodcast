"use client";

import { useState } from "react";
import { EpisodeVariantBundle, EpisodeTextVariant } from "@/lib/types";

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function VariantGroup({
  title,
  variants,
  accentClass,
}: {
  title: string;
  variants: EpisodeTextVariant[];
  accentClass?: string;
}) {
  const [feedback, setFeedback] = useState("");

  async function handleCopy(text: string, label: string) {
    try {
      await copyText(text);
      setFeedback(`${label} copied.`);
      window.setTimeout(() => setFeedback(""), 1800);
    } catch {
      setFeedback(`Failed to copy ${label.toLowerCase()}.`);
      window.setTimeout(() => setFeedback(""), 2200);
    }
  }

  return (
    <div className="rounded-[1.25rem] border border-ink/8 bg-white/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {feedback ? (
          <p className={`text-xs uppercase tracking-[0.2em] ${accentClass || "text-teal"}`}>{feedback}</p>
        ) : null}
      </div>
      <div className="mt-3 space-y-3">
        {variants.map((variant) => (
          <div key={variant.id} className="rounded-[1rem] border border-ink/8 bg-parchment px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/45">{variant.style}</p>
              <button
                type="button"
                onClick={() => handleCopy(variant.text, title)}
                className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-medium text-ink"
              >
                Copy
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink/74">{variant.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DistributionVariantsPanel({ variants }: { variants: EpisodeVariantBundle }) {
  return (
    <div className="mt-8 rounded-[1.75rem] border border-ink/8 bg-white/70 p-5">
      <p className="text-sm uppercase tracking-[0.3em] text-coral">Distribution Variants</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <VariantGroup title="Title Variants" variants={variants.titles} accentClass="text-coral" />
        <VariantGroup title="Hook Variants" variants={variants.hookLines} accentClass="text-coral" />
        <VariantGroup title="CTA Variants" variants={variants.ctas} accentClass="text-coral" />
        <VariantGroup title="Thumbnail Text" variants={variants.thumbnailTexts} accentClass="text-coral" />
      </div>
      <div className="mt-4 rounded-[1.25rem] border border-dashed border-teal/20 bg-teal/5 p-4">
        <VariantGroup title="Social Captions" variants={variants.socialCaptions} accentClass="text-teal" />
      </div>
    </div>
  );
}
