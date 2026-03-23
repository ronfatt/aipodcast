"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { voiceProfiles } from "@/lib/mock-data";
import { podcastTemplates } from "@/lib/templates";

export function NewEpisodeForm() {
  const router = useRouter();
  const [showName, setShowName] = useState("Future Banter");
  const [topic, setTopic] = useState("为什么 AI 双人播客比单人播报更容易留住听众？");
  const [sourceNotes, setSourceNotes] = useState(
    "输入文章摘要、采访笔记、新闻重点，系统会先生成大纲，再转成 Host A / Host B 对话。",
  );
  const [template, setTemplate] = useState("news-breakdown");
  const [hostAId, setHostAId] = useState("host-lin");
  const [hostBId, setHostBId] = useState("host-jay");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/episodes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          showName,
          topic,
          sourceNotes,
          template,
          hostAId,
          hostBId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to generate episode");
      }

      const payload = (await response.json()) as {
        episodeId: string;
        generationMode: "fallback" | "openai";
      };
      router.push(`/episodes/${payload.episodeId}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to generate episode");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="panel rounded-[2rem] p-8">
        <h2 className="font-display text-3xl text-ink">Episode brief</h2>
        <div className="mt-6 grid gap-5">
          <label className="grid gap-2 text-sm text-ink/70">
            Show name
            <input
              value={showName}
              onChange={(event) => setShowName(event.target.value)}
              className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm text-ink/70">
            Topic prompt
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm text-ink/70">
            Source notes
            <textarea
              rows={8}
              value={sourceNotes}
              onChange={(event) => setSourceNotes(event.target.value)}
              className="rounded-[1.4rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
            />
          </label>
          <p className="text-sm leading-6 text-ink/55">
            V1 先打通文本链路。你可以只输主题，也可以贴长文摘要，系统会生成双人对话草稿。
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="panel rounded-[2rem] p-8">
          <h2 className="font-display text-3xl text-ink">Template</h2>
          <div className="mt-5 space-y-4">
            {podcastTemplates.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer gap-4 rounded-[1.5rem] border border-ink/8 bg-white/75 p-4"
              >
                <input
                  type="radio"
                  name="template"
                  value={item.id}
                  checked={template === item.id}
                  onChange={(event) => setTemplate(event.target.value)}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-ink">{item.name}</p>
                  <p className="mt-1 text-sm leading-6 text-ink/68">{item.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-8">
          <h2 className="font-display text-3xl text-ink">Hosts</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-ink/70">
              Host A
              <select
                value={hostAId}
                onChange={(event) => setHostAId(event.target.value)}
                className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              >
                {voiceProfiles.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} · {voice.persona}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-ink/70">
              Host B
              <select
                value={hostBId}
                onChange={(event) => setHostBId(event.target.value)}
                className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              >
                {voiceProfiles.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} · {voice.persona}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <p className="mt-4 rounded-[1rem] border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
              {error}
            </p>
          ) : null}
          <p className="mt-4 text-sm leading-6 text-ink/55">
            If <code>OPENAI_API_KEY</code> is set, script generation uses OpenAI. Otherwise it falls
            back to the local template generator so the app still works.
          </p>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-parchment disabled:cursor-wait disabled:opacity-70"
          >
            {isSubmitting ? "Generating script..." : "Generate script"}
          </button>
        </div>
      </div>
    </form>
  );
}
