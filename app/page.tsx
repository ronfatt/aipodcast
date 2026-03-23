import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth-server";
import { listEpisodes } from "@/lib/episode-store";
import { sampleEpisodes, voiceProfiles } from "@/lib/mock-data";

const valueProps = [
  "从主题一句话生成双人播客脚本",
  "保留人工编辑，让内容不像流水线",
  "将两位主持人角色和声音固定成节目资产",
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const queueEpisodes = user ? (await listEpisodes(user.id)).slice(0, 3) : sampleEpisodes.slice(0, 3);

  return (
    <AppShell title="AIPodcast Studio" kicker="V1 Product Skeleton">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel rounded-[2rem] p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-coral">Product Thesis</p>
          <h2 className="mt-3 max-w-3xl font-display text-4xl text-ink">
            Turn a topic into an editable two-host show, then render it into podcast-ready audio.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink/72">
            V1 focuses on the core loop: source input, dual-host script generation, role-based voice
            selection, audio rendering, and export for manual upload to podcast platforms.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/episodes/new"
              className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-parchment transition hover:-translate-y-0.5"
            >
              Create first episode
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-ink/10 bg-white/70 px-5 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5"
            >
              View dashboard
            </Link>
          </div>
        </div>
        <div className="panel rounded-[2rem] p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-teal">Voice Roster</p>
          <div className="mt-4 space-y-4">
            {voiceProfiles.map((voice) => (
              <div key={voice.id} className="rounded-[1.5rem] border border-ink/8 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-ink">{voice.name}</h3>
                    <p className="text-sm text-ink/60">{voice.persona}</p>
                  </div>
                  <span className="rounded-full bg-gold/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-ink/70">
                    {voice.style}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink/74">“{voice.sampleLine}”</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="panel rounded-[2rem] p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-coral">Why This Shape</p>
          <ul className="mt-4 space-y-4 text-sm leading-7 text-ink/74">
            {valueProps.map((value) => (
              <li key={value} className="rounded-[1.25rem] border border-ink/8 bg-white/65 px-4 py-3">
                {value}
              </li>
            ))}
          </ul>
        </div>
        <div className="panel rounded-[2rem] p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-teal">Recent Drafts</p>
              <h2 className="mt-2 font-display text-3xl text-ink">Sample production queue</h2>
            </div>
            <Link href="/dashboard" className="text-sm font-semibold text-teal">
              See all
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {queueEpisodes.map((episode) => (
              <div key={episode.id} className="rounded-[1.5rem] border border-ink/8 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-ink">{episode.title}</h3>
                  <span className="text-sm text-ink/55">{episode.durationLabel}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-ink/70">{episode.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
