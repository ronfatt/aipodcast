"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { voiceProfiles } from "@/lib/mock-data";
import { conflictLevelLabel, personaModeLabel, personaModePresets, roleLabel } from "@/lib/personas";
import { podcastTemplates } from "@/lib/templates";

export function NewEpisodeForm() {
  const router = useRouter();
  const [showName, setShowName] = useState("Future Banter");
  const [topic, setTopic] = useState("为什么 AI 双人播客比单人播报更容易留住听众？");
  const [batchTopics, setBatchTopics] = useState("");
  const [sourceNotes, setSourceNotes] = useState(
    "输入文章摘要、采访笔记、新闻重点，系统会先生成大纲，再转成 Host A / Host B 对话。",
  );
  const [template, setTemplate] = useState("news-breakdown");
  const [personaMode, setPersonaMode] = useState<"reality-mode" | "insight-mode" | "custom">(
    "reality-mode",
  );
  const [conflictLevel, setConflictLevel] = useState<"low" | "medium" | "high">("medium");
  const [hostAId, setHostAId] = useState("host-lin");
  const [hostBId, setHostBId] = useState("host-jay");
  const [generationMode, setGenerationMode] = useState<"single" | "batch">("single");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const parsedBatchTopics = batchTopics
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (generationMode === "batch" && parsedBatchTopics.length === 0) {
        throw new Error("Please enter at least one topic in batch mode.");
      }

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
          personaMode,
          conflictLevel,
          batchTopics: generationMode === "batch" ? parsedBatchTopics : [],
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to generate episode");
      }

      const payload = (await response.json()) as
        | {
            episodeId: string;
            generationMode: "fallback" | "openai";
          }
        | {
            createdCount: number;
            episodeIds: string[];
            generationModes: Array<"fallback" | "openai">;
          };

      if ("createdCount" in payload) {
        router.push(`/dashboard?created=${payload.createdCount}`);
        router.refresh();
        return;
      }

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
          <div className="grid gap-3">
            <p className="text-sm text-ink/70">Generation mode</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer gap-3 rounded-[1.25rem] border border-ink/10 bg-white/75 p-4">
                <input
                  type="radio"
                  name="generationMode"
                  checked={generationMode === "single"}
                  onChange={() => setGenerationMode("single")}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-ink">Single episode</p>
                  <p className="mt-1 text-sm leading-6 text-ink/68">
                    输入一个主题，直接跳进单集脚本页继续编辑。
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-[1.25rem] border border-ink/10 bg-white/75 p-4">
                <input
                  type="radio"
                  name="generationMode"
                  checked={generationMode === "batch"}
                  onChange={() => setGenerationMode("batch")}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-ink">Batch episodes</p>
                  <p className="mt-1 text-sm leading-6 text-ink/68">
                    一次贴入多条选题，批量生成整组节目草稿。
                  </p>
                </div>
              </label>
            </div>
          </div>
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
          {generationMode === "batch" ? (
            <label className="grid gap-2 text-sm text-ink/70">
              Batch topic list
              <textarea
                rows={7}
                value={batchTopics}
                onChange={(event) => setBatchTopics(event.target.value)}
                placeholder={"每行一个选题\nAI 搜索会不会吞掉网站流量？\n为什么双人结构更适合资讯播客？\n用 AI 批量做播客，哪里最容易翻车？"}
                className="rounded-[1.4rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              />
            </label>
          ) : null}
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
            {generationMode === "batch"
              ? "批量模式会复用同一份资料和主持人配置，把每一行选题都生成成一集双人脚本。"
              : "V1 先打通文本链路。你可以只输主题，也可以贴长文摘要，系统会生成双人对话草稿。"}
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
          <h2 className="font-display text-3xl text-ink">Persona Mode</h2>
          <div className="mt-5 space-y-4">
            {personaModePresets.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer gap-4 rounded-[1.5rem] border border-ink/8 bg-white/75 p-4"
              >
                <input
                  type="radio"
                  name="personaMode"
                  value={item.id}
                  checked={personaMode === item.id}
                  onChange={() => {
                    setPersonaMode(item.id);
                    setHostAId(item.hostAId);
                    setHostBId(item.hostBId);
                  }}
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
          <h2 className="font-display text-3xl text-ink">Conflict Slider</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              {
                value: "low" as const,
                title: "Low",
                description: "更温和，适合解释型和大众向节目。",
              },
              {
                value: "medium" as const,
                title: "Medium",
                description: "正常拉扯感，既有追问，也不至于像吵架。",
              },
              {
                value: "high" as const,
                title: "High",
                description: "更尖锐，打断和拆逻辑更明显，但仍然不失控。",
              },
            ].map((item) => (
              <label
                key={item.value}
                className="flex cursor-pointer gap-3 rounded-[1.5rem] border border-ink/8 bg-white/75 p-4"
              >
                <input
                  type="radio"
                  name="conflictLevel"
                  value={item.value}
                  checked={conflictLevel === item.value}
                  onChange={() => setConflictLevel(item.value)}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-ink">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-ink/68">{item.description}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-ink/55">
            Current tension: <span className="font-semibold text-ink">{conflictLevelLabel(conflictLevel)}</span>.
            在 <span className="font-semibold text-ink">Reality Mode</span> 下最明显，在其他模式下也会影响追问强度和句子锐度。
          </p>
        </div>

        <div className="panel rounded-[2rem] p-8">
          <h2 className="font-display text-3xl text-ink">Hosts</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-ink/70">
              Host A
              <select
                value={hostAId}
                onChange={(event) => {
                  setHostAId(event.target.value);
                  setPersonaMode("custom");
                }}
                className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              >
                {voiceProfiles.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} · {roleLabel(voice.role)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-ink/70">
              Host B
              <select
                value={hostBId}
                onChange={(event) => {
                  setHostBId(event.target.value);
                  setPersonaMode("custom");
                }}
                className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              >
                {voiceProfiles.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} · {roleLabel(voice.role)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-4 text-sm leading-6 text-ink/55">
            Current pairing: <span className="font-semibold text-ink">{personaModeLabel(personaMode)}</span>. Custom host changes will switch this to a manual pairing.
          </p>

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
            {isSubmitting
              ? generationMode === "batch"
                ? "Generating batch..."
                : "Generating script..."
              : generationMode === "batch"
                ? "Generate batch"
                : "Generate script"}
          </button>
        </div>
      </div>
    </form>
  );
}
