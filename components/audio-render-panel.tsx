"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AudioRenderPanel({
  episodeId,
  audioUrl,
}: {
  episodeId: string;
  audioUrl?: string;
}) {
  const router = useRouter();
  const [isRendering, setIsRendering] = useState(false);
  const [localAudioUrl, setLocalAudioUrl] = useState(audioUrl);
  const [error, setError] = useState("");

  async function handleRender() {
    setError("");
    setIsRendering(true);

    try {
      const response = await fetch(`/api/episodes/${episodeId}/render-audio`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to render audio.");
      }

      const payload = (await response.json()) as { audioUrl: string };
      setLocalAudioUrl(`${payload.audioUrl}?t=${Date.now()}`);
      router.refresh();
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : "Failed to render audio.");
    } finally {
      setIsRendering(false);
    }
  }

  return (
    <div className="mt-6 rounded-[1.5rem] border border-ink/8 bg-white/70 p-4">
      <p className="text-sm font-semibold text-ink">Audio export</p>
      <p className="mt-2 text-sm leading-6 text-ink/68">
        Render this script into podcast audio. On deployed environments the app now uses OpenAI TTS;
        on local macOS it can still fall back to system voices.
      </p>

      {localAudioUrl ? (
        <div className="mt-4 space-y-3">
          <audio controls className="w-full" src={localAudioUrl}>
            Your browser does not support audio playback.
          </audio>
          <a
            href={localAudioUrl}
            download
            className="inline-flex rounded-full border border-ink/10 bg-ink px-4 py-2 text-sm font-medium text-parchment"
          >
            Download audio
          </a>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-[1rem] border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleRender}
        disabled={isRendering}
        className="mt-4 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-parchment disabled:cursor-wait disabled:opacity-70"
      >
        {isRendering ? "Rendering audio..." : localAudioUrl ? "Render again" : "Render audio"}
      </button>
    </div>
  );
}
