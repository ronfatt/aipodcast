"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { voiceProfiles } from "@/lib/mock-data";
import { conflictLevelLabel, personaModeLabel, personaModePresets, roleLabel } from "@/lib/personas";
import { Show, TopicScore } from "@/lib/types";
import { podcastTemplates } from "@/lib/templates";

type EpisodePrefills = {
  showId?: string;
  showName?: string;
  recommendationId?: string;
  recommendationTitle?: string;
  topic?: string;
  sourceNotes?: string;
  template?: string;
  hostAId?: string;
  hostBId?: string;
  personaMode?: string;
  conflictLevel?: string;
};

export function NewEpisodeForm({
  shows,
  prefills,
}: {
  shows: Show[];
  prefills?: EpisodePrefills;
}) {
  const router = useRouter();
  const initialShow =
    (prefills?.showId ? shows.find((show) => show.id === prefills.showId) : undefined) || shows[0];
  const [showId, setShowId] = useState<string | undefined>(prefills?.showId || initialShow?.id);
  const [showName, setShowName] = useState(prefills?.showName || initialShow?.name || "Future Banter");
  const [showProfileId, setShowProfileId] = useState(initialShow?.id || "custom-show");
  const [showTagline, setShowTagline] = useState(initialShow?.tagline || "");
  const [showCoverImageUrl, setShowCoverImageUrl] = useState(initialShow?.coverImageUrl || "");
  const [targetAudience, setTargetAudience] = useState(initialShow?.audience || "");
  const [showFormat, setShowFormat] = useState(initialShow?.format || "");
  const [introStyle, setIntroStyle] = useState(initialShow?.introStyle || "");
  const [outroStyle, setOutroStyle] = useState(initialShow?.outroStyle || "");
  const [defaultIntro, setDefaultIntro] = useState(initialShow?.defaultIntro || "");
  const [defaultOutro, setDefaultOutro] = useState(initialShow?.defaultOutro || "");
  const [defaultDescription, setDefaultDescription] = useState(initialShow?.defaultDescription || "");
  const [topic, setTopic] = useState(prefills?.topic || "为什么 AI 双人播客比单人播报更容易留住听众？");
  const [batchTopics, setBatchTopics] = useState("");
  const [sourceNotes, setSourceNotes] = useState(
    prefills?.sourceNotes ||
      "输入文章摘要、采访笔记、新闻重点，系统会先生成大纲，再转成 Host A / Host B 对话。",
  );
  const [template, setTemplate] = useState(prefills?.template || "news-breakdown");
  const [personaMode, setPersonaMode] = useState<"reality-mode" | "insight-mode" | "custom">(
    (prefills?.personaMode as "reality-mode" | "insight-mode" | "custom") || "reality-mode",
  );
  const [conflictLevel, setConflictLevel] = useState<"low" | "medium" | "high">(
    (prefills?.conflictLevel as "low" | "medium" | "high") || "medium",
  );
  const [hostAId, setHostAId] = useState(prefills?.hostAId || initialShow?.hostAId || "host-lin");
  const [hostBId, setHostBId] = useState(prefills?.hostBId || initialShow?.hostBId || "host-jay");
  const [generationMode, setGenerationMode] = useState<"single" | "batch">("single");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [error, setError] = useState("");
  const [topicScore, setTopicScore] = useState<TopicScore>();
  const [topicRewrites, setTopicRewrites] = useState<string[]>([]);

  async function scoreCurrentTopic() {
    setError("");
    setIsScoring(true);

    try {
      const response = await fetch("/api/topic-score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          showId,
          showName,
          showProfileId,
          recommendationId: prefills?.recommendationId,
          recommendationTitle: prefills?.recommendationTitle,
          showTagline,
          showCoverImageUrl,
          targetAudience,
          showFormat,
          introStyle,
          outroStyle,
          defaultIntro,
          defaultOutro,
          defaultDescription,
          topic,
          sourceNotes,
          template,
          hostAId,
          hostBId,
          personaMode,
          conflictLevel,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to score topic.");
      }

      const payload = (await response.json()) as { topicScore: TopicScore; rewrites: string[] };
      setTopicScore(payload.topicScore);
      setTopicRewrites(payload.rewrites);
    } catch (scoringError) {
      setError(scoringError instanceof Error ? scoringError.message : "Failed to score topic.");
    } finally {
      setIsScoring(false);
    }
  }

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
          showId,
          showName,
          showProfileId,
          showTagline,
          showCoverImageUrl,
          targetAudience,
          showFormat,
          introStyle,
          outroStyle,
          defaultIntro,
          defaultOutro,
          defaultDescription,
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
        const payload = (await response.json()) as {
          error?: string;
          topicScore?: TopicScore;
          rewrites?: string[];
        };
        if (response.status === 422 && payload.topicScore) {
          setTopicScore(payload.topicScore);
          setTopicRewrites(payload.rewrites || []);
        }
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
        {prefills?.recommendationTitle ? (
          <div className="mt-5 rounded-[1.5rem] border border-teal/18 bg-teal/8 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-teal">Recommendation Applied</p>
            <p className="mt-2 text-base font-semibold text-ink">{prefills.recommendationTitle}</p>
            <p className="mt-2 text-sm leading-6 text-ink/68">
              这份 brief 是从优化建议直接带过来的，下面的 topic、notes、冲突等级和 host 组合已经按建议预填。
            </p>
          </div>
        ) : null}
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
              onChange={(event) => {
                setShowName(event.target.value);
                setShowId(undefined);
                setShowProfileId("custom-show");
              }}
              className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm text-ink/70">
            Show tagline
            <input
              value={showTagline}
              onChange={(event) => setShowTagline(event.target.value)}
              className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm text-ink/70">
            Topic prompt
            <input
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                setTopicScore(undefined);
                setTopicRewrites([]);
              }}
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
              onChange={(event) => {
                setSourceNotes(event.target.value);
                setTopicScore(undefined);
                setTopicRewrites([]);
              }}
              className="rounded-[1.4rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
            />
          </label>
          <div className="rounded-[1.5rem] border border-ink/8 bg-white/70 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-coral">Topic Score</p>
                <p className="mt-2 text-sm leading-6 text-ink/68">
                  先判断这个题目够不够炸，再决定要不要直接生成。
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={scoreCurrentTopic}
                  disabled={isScoring || isSubmitting}
                  className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium text-ink disabled:cursor-wait disabled:opacity-70"
                >
                  {isScoring ? "Scoring..." : "Score Topic"}
                </button>
                <button
                  type="button"
                  onClick={scoreCurrentTopic}
                  disabled={isScoring || isSubmitting}
                  className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-parchment disabled:cursor-wait disabled:opacity-70"
                >
                  Improve Topic
                </button>
              </div>
            </div>
            {topicScore ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Overall", topicScore.overallScore],
                    ["Controversy", topicScore.controversyScore],
                    ["Relevance", topicScore.relevanceScore],
                    ["Pain", topicScore.audiencePainScore],
                    ["Clipability", topicScore.clipabilityScore],
                    ["Monetization", topicScore.monetizationScore],
                    ["Hook", topicScore.hookScore],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[1rem] border border-ink/8 bg-parchment px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-ink/45">{label}</p>
                      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-[1rem] border border-dashed border-teal/20 bg-teal/5 px-4 py-3 text-sm leading-6 text-ink/70">
                  {topicScore.rationale}
                </div>
                {topicRewrites.length ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-ink">Stronger rewrites</p>
                    {topicRewrites.map((rewrite) => (
                      <button
                        key={rewrite}
                        type="button"
                        onClick={() => {
                          setTopic(rewrite);
                          setError("");
                        }}
                        className="block w-full rounded-[1rem] border border-ink/8 bg-white px-4 py-3 text-left text-sm leading-6 text-ink transition hover:border-teal/25"
                      >
                        {rewrite}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-ink/55">
            {generationMode === "batch"
              ? "批量模式会复用同一份资料和主持人配置，把每一行选题都生成成一集双人脚本。"
              : "V1 先打通文本链路。你可以只输主题，也可以贴长文摘要，系统会生成双人对话草稿。"}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="panel rounded-[2rem] p-8">
          <h2 className="font-display text-3xl text-ink">Show Identity</h2>
          <div className="mt-5 space-y-4">
            {shows.map((profile) => (
              <label
                key={profile.id}
                className="flex cursor-pointer gap-4 rounded-[1.5rem] border border-ink/8 bg-white/75 p-4"
              >
                <input
                  type="radio"
                  name="showProfile"
                  value={profile.id}
                  checked={showProfileId === profile.id}
                  onChange={() => {
                    setShowId(profile.id);
                    setShowProfileId(profile.id);
                    setShowName(profile.name);
                    setShowTagline(profile.tagline);
                    setShowCoverImageUrl(profile.coverImageUrl || "");
                    setTargetAudience(profile.audience);
                    setShowFormat(profile.format);
                    setIntroStyle(profile.introStyle);
                    setOutroStyle(profile.outroStyle);
                    setDefaultIntro(profile.defaultIntro || "");
                    setDefaultOutro(profile.defaultOutro || "");
                    setDefaultDescription(profile.defaultDescription || "");
                    setTemplate(profile.template);
                    setPersonaMode(profile.personaMode);
                    setConflictLevel(profile.conflictLevel);
                    setHostAId(profile.hostAId);
                    setHostBId(profile.hostBId);
                  }}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-ink">{profile.name}</p>
                  <p className="mt-1 text-sm leading-6 text-ink/68">{profile.tagline}</p>
                  {profile.defaultDescription ? (
                    <p className="mt-2 text-sm leading-6 text-ink/58">{profile.defaultDescription}</p>
                  ) : null}
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-ink/45">
                    {profile.category} · {profile.publishingCadence}
                  </p>
                </div>
              </label>
            ))}
          </div>
          {showCoverImageUrl ? (
            <div
              className="mt-5 h-40 rounded-[1.5rem] border border-ink/8 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(rgba(19,20,18,0.14), rgba(19,20,18,0.14)), url(${showCoverImageUrl})`,
              }}
            />
          ) : null}
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm text-ink/70">
              Target audience
              <input
                value={targetAudience}
                onChange={(event) => {
                  setTargetAudience(event.target.value);
                  setShowProfileId("custom-show");
                }}
                className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              />
            </label>
            <label className="grid gap-2 text-sm text-ink/70">
              Show format
              <input
                value={showFormat}
                onChange={(event) => {
                  setShowFormat(event.target.value);
                  setShowProfileId("custom-show");
                }}
                className="rounded-[1.1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              />
            </label>
            <label className="grid gap-2 text-sm text-ink/70">
              Intro style
              <textarea
                rows={3}
                value={introStyle}
                onChange={(event) => {
                  setIntroStyle(event.target.value);
                  setShowProfileId("custom-show");
                }}
                className="rounded-[1.2rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              />
            </label>
            <label className="grid gap-2 text-sm text-ink/70">
              Outro style
              <textarea
                rows={3}
                value={outroStyle}
                onChange={(event) => {
                  setOutroStyle(event.target.value);
                  setShowProfileId("custom-show");
                }}
                className="rounded-[1.2rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              />
            </label>
            <label className="grid gap-2 text-sm text-ink/70">
              Default spoken intro
              <textarea
                rows={3}
                value={defaultIntro}
                onChange={(event) => {
                  setDefaultIntro(event.target.value);
                  setShowId(undefined);
                  setShowProfileId("custom-show");
                }}
                className="rounded-[1.2rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              />
            </label>
            <label className="grid gap-2 text-sm text-ink/70">
              Default spoken outro
              <textarea
                rows={3}
                value={defaultOutro}
                onChange={(event) => {
                  setDefaultOutro(event.target.value);
                  setShowId(undefined);
                  setShowProfileId("custom-show");
                }}
                className="rounded-[1.2rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              />
            </label>
            <label className="grid gap-2 text-sm text-ink/70">
              Default show description
              <textarea
                rows={4}
                value={defaultDescription}
                onChange={(event) => {
                  setDefaultDescription(event.target.value);
                  setShowId(undefined);
                  setShowProfileId("custom-show");
                }}
                className="rounded-[1.2rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
              />
            </label>
          </div>
        </div>

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
