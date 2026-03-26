"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Episode } from "@/lib/types";

export function EpisodeEditor({ episode }: { episode: Episode }) {
  const router = useRouter();
  const [title, setTitle] = useState(episode.title);
  const [summary, setSummary] = useState(episode.summary);
  const [showNotes, setShowNotes] = useState(episode.showNotes.join("\n"));
  const [cta, setCta] = useState(episode.cta);
  const [script, setScript] = useState(episode.script);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  function updateScriptText(index: number, text: string) {
    setScript((current) =>
      current.map((turn, turnIndex) => (turnIndex === index ? { ...turn, text } : turn)),
    );
  }

  async function handleSave() {
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/episodes/${episode.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          summary,
          showNotes: showNotes
            .split("\n")
            .map((note) => note.trim())
            .filter(Boolean),
          cta,
          script,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to save episode.");
      }

      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save episode.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm("Delete this episode and its generated assets?");
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/episodes/${episode.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to delete episode.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete episode.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="mt-8 rounded-[1.75rem] border border-ink/8 bg-white/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm uppercase tracking-[0.3em] text-coral">Editor</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isDeleting}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-parchment disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSaving || isDeleting}
            className="rounded-full border border-coral/20 bg-coral/10 px-4 py-2 text-sm font-medium text-coral disabled:opacity-70"
          >
            {isDeleting ? "Deleting..." : "Delete episode"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-[1rem] border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm text-ink/70">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
          />
        </label>
        <label className="grid gap-2 text-sm text-ink/70">
          Summary
          <textarea
            rows={4}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
          />
        </label>
        <label className="grid gap-2 text-sm text-ink/70">
          Show notes
          <textarea
            rows={5}
            value={showNotes}
            onChange={(event) => setShowNotes(event.target.value)}
            className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
          />
        </label>
        <label className="grid gap-2 text-sm text-ink/70">
          CTA
          <textarea
            rows={3}
            value={cta}
            onChange={(event) => setCta(event.target.value)}
            className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
          />
        </label>
      </div>

      <div className="mt-6 space-y-4">
        {script.map((turn, index) => (
          <label key={turn.id} className="grid gap-2 text-sm text-ink/70">
            Host {turn.speaker}{turn.segment ? ` · ${turn.segment.replace(/_/g, " ")}` : ""}
            <textarea
              rows={3}
              value={turn.text}
              onChange={(event) => updateScriptText(index, event.target.value)}
              className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
