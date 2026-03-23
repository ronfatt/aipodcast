"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ExportPackagePanel({
  episodeId,
  exportPackageUrl,
}: {
  episodeId: string;
  exportPackageUrl?: string;
}) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [packageUrl, setPackageUrl] = useState(exportPackageUrl);
  const [error, setError] = useState("");

  async function handleExport() {
    setIsExporting(true);
    setError("");

    try {
      const response = await fetch(`/api/episodes/${episodeId}/export-package`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to export publishing package.");
      }

      const payload = (await response.json()) as { packageUrl: string };
      setPackageUrl(`${payload.packageUrl}?t=${Date.now()}`);
      router.refresh();
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Failed to export publishing package.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="mt-6 rounded-[1.5rem] border border-ink/8 bg-white/70 p-4">
      <p className="text-sm font-semibold text-ink">Publishing package</p>
      <p className="mt-2 text-sm leading-6 text-ink/68">
        Export a zip with the mp3, title, summary, show notes, CTA, and metadata for manual upload
        to podcast platforms.
      </p>

      {packageUrl ? (
        <a
          href={packageUrl}
          download
          className="mt-4 inline-flex rounded-full border border-ink/10 bg-ink px-4 py-2 text-sm font-medium text-parchment"
        >
          Download zip package
        </a>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-[1rem] border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="mt-4 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-parchment disabled:cursor-wait disabled:opacity-70"
      >
        {isExporting ? "Preparing package..." : packageUrl ? "Export again" : "Export publishing package"}
      </button>
    </div>
  );
}
