"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BackgroundMusicLevel, Show } from "@/lib/types";
import { voiceProfiles } from "@/lib/mock-data";

function ShowAudioPreviewControls({ show }: { show: Show }) {
  const [isRendering, setIsRendering] = useState<"intro" | "bed" | "outro" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [error, setError] = useState("");

  async function handlePreview(kind: "intro" | "bed" | "outro") {
    setError("");
    setIsRendering(kind);

    try {
      const response = await fetch(`/api/shows/${show.id}/preview-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ kind }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to render preview.");
      }

      const payload = (await response.json()) as { audioUrl: string };
      setPreviewUrl(`${payload.audioUrl}?t=${Date.now()}`);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Failed to render preview.");
    } finally {
      setIsRendering(null);
    }
  }

  return (
    <div className="mt-4 rounded-[1.1rem] border border-ink/8 bg-white/70 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-teal">Audio Preview</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { kind: "intro" as const, label: "Preview intro" },
          { kind: "bed" as const, label: "Preview background bed" },
          { kind: "outro" as const, label: "Preview outro" },
        ].map((item) => (
          <button
            key={item.kind}
            type="button"
            onClick={() => handlePreview(item.kind)}
            disabled={isRendering !== null}
            className="rounded-full border border-ink/10 bg-ink px-4 py-2 text-sm font-medium text-parchment disabled:cursor-wait disabled:opacity-70"
          >
            {isRendering === item.kind ? "Rendering..." : item.label}
          </button>
        ))}
      </div>
      {previewUrl ? (
        <audio controls className="mt-4 w-full" src={previewUrl}>
          Your browser does not support audio playback.
        </audio>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-[1rem] border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ShowAssetUploader({
  show,
  assetType,
  label,
  accept,
  currentUrl,
}: {
  show: Show;
  assetType: "cover" | "background" | "intro_sting" | "outro_sting";
  label: string;
  accept: string;
  currentUrl?: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload() {
    if (!file) {
      setError("Please choose a file first.");
      return;
    }

    setError("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("assetType", assetType);
      formData.append("file", file);

      const response = await fetch(`/api/shows/${show.id}/assets`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Upload failed.");
      }

      setFile(null);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="rounded-[1rem] border border-ink/8 bg-white/70 p-4">
      <p className="text-sm font-semibold text-ink">{label}</p>
      {currentUrl ? (
        <a href={currentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-teal">
          Current asset
        </a>
      ) : (
        <p className="mt-2 text-sm text-ink/55">No asset uploaded yet.</p>
      )}
      <input
        type="file"
        accept={accept}
        onChange={(event) => setFile(event.target.files?.[0] || null)}
        className="mt-3 block w-full text-sm text-ink/70 file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-medium file:text-parchment"
      />
      <button
        type="button"
        onClick={handleUpload}
        disabled={isUploading}
        className="mt-3 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium text-ink disabled:cursor-wait disabled:opacity-70"
      >
        {isUploading ? "Uploading..." : "Upload asset"}
      </button>
      {error ? (
        <p className="mt-3 rounded-[0.9rem] border border-coral/20 bg-coral/10 px-3 py-2 text-sm text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ShowManager({ shows }: { shows: Show[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [category, setCategory] = useState("Custom Show");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [format, setFormat] = useState("8-12 分钟双人对话节目");
  const [audience, setAudience] = useState("General creators");
  const [publishingCadence, setPublishingCadence] = useState("每周更新");
  const [introStyle, setIntroStyle] = useState("开场快速说明这集为什么值得听。");
  const [outroStyle, setOutroStyle] = useState("结尾收成一个 takeaway 和行动建议。");
  const [defaultIntro, setDefaultIntro] = useState("");
  const [defaultOutro, setDefaultOutro] = useState("");
  const [defaultDescription, setDefaultDescription] = useState("");
  const [backgroundMusicUrl, setBackgroundMusicUrl] = useState("");
  const [backgroundMusicLevel, setBackgroundMusicLevel] = useState<BackgroundMusicLevel>("subtle");
  const [introStingUrl, setIntroStingUrl] = useState("");
  const [outroStingUrl, setOutroStingUrl] = useState("");
  const [template, setTemplate] = useState("insight-chat");
  const [personaMode, setPersonaMode] = useState<"reality-mode" | "insight-mode" | "custom">("reality-mode");
  const [conflictLevel, setConflictLevel] = useState<"low" | "medium" | "high">("medium");
  const [hostAId, setHostAId] = useState("host-lin");
  const [hostBId, setHostBId] = useState("host-jay");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/shows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          tagline,
          category,
          coverImageUrl,
          format,
          audience,
          publishingCadence,
          introStyle,
          outroStyle,
          defaultIntro,
          defaultOutro,
          defaultDescription,
          backgroundMusicUrl,
          backgroundMusicLevel,
          introStingUrl,
          outroStingUrl,
          template,
          personaMode,
          conflictLevel,
          hostAId,
          hostBId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to create show.");
      }

      setName("");
      setTagline("");
      setCoverImageUrl("");
      setDefaultIntro("");
      setDefaultOutro("");
      setDefaultDescription("");
      setBackgroundMusicUrl("");
      setBackgroundMusicLevel("subtle");
      setIntroStingUrl("");
      setOutroStingUrl("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create show.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="panel rounded-[2rem] p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-coral">Show Library</p>
        <h2 className="mt-3 font-display text-3xl text-ink">Your recurring podcast identities</h2>
        <div className="mt-6 space-y-4">
          {shows.map((show) => (
            <article key={show.id} className="rounded-[1.5rem] border border-ink/8 bg-white/70 p-5">
              {show.coverImageUrl ? (
                <div
                  className="mb-4 h-36 rounded-[1.25rem] bg-cover bg-center"
                  style={{
                    backgroundImage: `linear-gradient(rgba(19,20,18,0.14), rgba(19,20,18,0.14)), url(${show.coverImageUrl})`,
                  }}
                />
              ) : null}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-ink/45">{show.category}</p>
                  <h3 className="mt-2 text-xl font-semibold text-ink">{show.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/70">{show.tagline}</p>
                </div>
                <span className="text-sm text-ink/55">{show.publishingCadence}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-ink/62">
                <p>{show.format}</p>
                <p>Audience: {show.audience}</p>
                {show.defaultDescription ? <p>{show.defaultDescription}</p> : null}
                {show.backgroundMusicUrl ? <p>BGM: {show.backgroundMusicLevel || "subtle"}</p> : null}
              </div>
              {show.defaultIntro || show.defaultOutro ? (
                <div className="mt-4 rounded-[1.1rem] border border-dashed border-teal/20 bg-teal/5 p-4 text-sm leading-6 text-ink/68">
                  {show.defaultIntro ? <p>Intro: {show.defaultIntro}</p> : null}
                  {show.defaultOutro ? (
                    <p className={show.defaultIntro ? "mt-2" : ""}>Outro: {show.defaultOutro}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-4 space-y-2 text-xs uppercase tracking-[0.2em] text-ink/45">
                <p>Persona: {show.personaMode}</p>
                <p>Conflict: {show.conflictLevel}</p>
                {show.introStingUrl ? <p>Intro sting enabled</p> : null}
                {show.outroStingUrl ? <p>Outro sting enabled</p> : null}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <ShowAssetUploader
                  show={show}
                  assetType="cover"
                  label="Cover"
                  accept="image/png,image/jpeg,image/webp"
                  currentUrl={show.coverImageUrl}
                />
                <ShowAssetUploader
                  show={show}
                  assetType="background"
                  label="Background Music"
                  accept="audio/wav"
                  currentUrl={show.backgroundMusicUrl}
                />
                <ShowAssetUploader
                  show={show}
                  assetType="intro_sting"
                  label="Intro Sting"
                  accept="audio/wav"
                  currentUrl={show.introStingUrl}
                />
                <ShowAssetUploader
                  show={show}
                  assetType="outro_sting"
                  label="Outro Sting"
                  accept="audio/wav"
                  currentUrl={show.outroStingUrl}
                />
              </div>
              <ShowAudioPreviewControls show={show} />
            </article>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="panel rounded-[2rem] p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-teal">Create Show</p>
        <h2 className="mt-3 font-display text-3xl text-ink">Add a new show profile</h2>
        <div className="mt-6 grid gap-4">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Show name" className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <input value={tagline} onChange={(event) => setTagline(event.target.value)} placeholder="Show tagline" className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <input value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} placeholder="Cover image URL" className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <input value={format} onChange={(event) => setFormat(event.target.value)} placeholder="Show format" className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Target audience" className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <input value={publishingCadence} onChange={(event) => setPublishingCadence(event.target.value)} placeholder="Publishing cadence" className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <textarea value={introStyle} onChange={(event) => setIntroStyle(event.target.value)} rows={3} placeholder="Intro style" className="rounded-[1.2rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <textarea value={outroStyle} onChange={(event) => setOutroStyle(event.target.value)} rows={3} placeholder="Outro style" className="rounded-[1.2rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <textarea value={defaultIntro} onChange={(event) => setDefaultIntro(event.target.value)} rows={3} placeholder="Default spoken intro" className="rounded-[1.2rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <textarea value={defaultOutro} onChange={(event) => setDefaultOutro(event.target.value)} rows={3} placeholder="Default spoken outro" className="rounded-[1.2rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <textarea value={defaultDescription} onChange={(event) => setDefaultDescription(event.target.value)} rows={4} placeholder="Default show description / publishing copy" className="rounded-[1.2rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <input value={backgroundMusicUrl} onChange={(event) => setBackgroundMusicUrl(event.target.value)} placeholder="Background music WAV URL" className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <select value={backgroundMusicLevel} onChange={(event) => setBackgroundMusicLevel(event.target.value as BackgroundMusicLevel)} className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none">
            <option value="subtle">BGM level · Subtle</option>
            <option value="balanced">BGM level · Balanced</option>
            <option value="forward">BGM level · Forward</option>
          </select>
          <input value={introStingUrl} onChange={(event) => setIntroStingUrl(event.target.value)} placeholder="Intro sting WAV URL" className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <input value={outroStingUrl} onChange={(event) => setOutroStingUrl(event.target.value)} placeholder="Outro sting WAV URL" className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none" />
          <div className="grid gap-4 sm:grid-cols-2">
            <select value={hostAId} onChange={(event) => setHostAId(event.target.value)} className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none">
              {voiceProfiles.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  Host A · {voice.name}
                </option>
              ))}
            </select>
            <select value={hostBId} onChange={(event) => setHostBId(event.target.value)} className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none">
              {voiceProfiles.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  Host B · {voice.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-[1rem] border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-parchment disabled:cursor-wait disabled:opacity-70"
        >
          {isSubmitting ? "Creating show..." : "Create show"}
        </button>
      </form>
    </section>
  );
}
