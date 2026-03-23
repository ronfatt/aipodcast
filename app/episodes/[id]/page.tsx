import Link from "next/link";
import { notFound } from "next/navigation";
import { AudioRenderPanel } from "@/components/audio-render-panel";
import { AppShell } from "@/components/app-shell";
import { EpisodeEditor } from "@/components/episode-editor";
import { ExportPackagePanel } from "@/components/export-package-panel";
import { ScriptPreview } from "@/components/script-preview";
import { requireUser } from "@/lib/auth-server";
import { getEpisodeById } from "@/lib/episode-store";
import { inferPersonaMode, personaModeLabel, roleLabel } from "@/lib/personas";

export default async function EpisodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const episode = await getEpisodeById(id, user?.id);

  if (!episode) {
    notFound();
  }

  const personaMode = inferPersonaMode(episode.hostA, episode.hostB);

  return (
    <AppShell title={episode.title} kicker="Script Editor">
      <section className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr_0.7fr]">
        <aside className="panel rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-coral">Episode Meta</p>
          <dl className="mt-5 space-y-4 text-sm text-ink/74">
            <div>
              <dt className="text-ink/45">Show</dt>
              <dd className="mt-1 text-base text-ink">{episode.showName}</dd>
            </div>
            <div>
              <dt className="text-ink/45">Status</dt>
              <dd className="mt-1 text-base text-ink">{episode.status}</dd>
            </div>
            <div>
              <dt className="text-ink/45">Duration target</dt>
              <dd className="mt-1 text-base text-ink">{episode.durationLabel}</dd>
            </div>
            <div>
              <dt className="text-ink/45">Source type</dt>
              <dd className="mt-1 text-base capitalize text-ink">{episode.sourceType}</dd>
            </div>
            <div>
              <dt className="text-ink/45">Template</dt>
              <dd className="mt-1 text-base text-ink">{episode.template}</dd>
            </div>
            <div>
              <dt className="text-ink/45">Persona mode</dt>
              <dd className="mt-1 text-base text-ink">{personaModeLabel(personaMode)}</dd>
            </div>
            <div>
              <dt className="text-ink/45">Generation mode</dt>
              <dd className="mt-1 text-base text-ink">{episode.generationMode ?? "fallback"}</dd>
            </div>
          </dl>
          <Link
            href="/episodes/new"
            className="mt-8 inline-flex rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium text-ink"
          >
            New episode
          </Link>
        </aside>

        <main className="panel rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-teal">Dialogue Draft</p>
          <h2 className="mt-3 font-display text-3xl text-ink">Editable script preview</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70">{episode.summary}</p>
          <div className="mt-4 rounded-[1.5rem] border border-ink/8 bg-white/65 p-4 text-sm leading-6 text-ink/68">
            {episode.sourceContent}
          </div>
          <div className="mt-6">
            <ScriptPreview turns={episode.script} />
          </div>
          <EpisodeEditor episode={episode} />
          <div className="mt-8 rounded-[1.75rem] border border-ink/8 bg-white/70 p-5">
            <p className="text-sm uppercase tracking-[0.3em] text-coral">Publishing Copy</p>
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-ink">Show Notes</h3>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-ink/74">
                {episode.showNotes.map((note) => (
                  <li key={note} className="rounded-[1.1rem] border border-ink/8 bg-white/80 px-4 py-3">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-5 rounded-[1.25rem] border border-dashed border-teal/20 bg-teal/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-teal">CTA</p>
              <p className="mt-2 text-sm leading-6 text-ink/74">{episode.cta}</p>
            </div>
          </div>
        </main>

        <aside className="panel rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-coral">Voice Setup</p>
          <div className="mt-5 space-y-4">
            {[
              { label: "Host A", voice: episode.hostA },
              { label: "Host B", voice: episode.hostB },
            ].map((item) => (
              <div key={item.label} className="rounded-[1.5rem] border border-ink/8 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-ink/45">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-ink">{item.voice.name}</p>
                <p className="text-sm text-ink/70">{item.voice.persona}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-teal">
                  {roleLabel(item.voice.role)}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-ink/45">
                  macOS voice: {item.voice.systemVoice}
                </p>
                <p className="mt-3 text-sm leading-6 text-ink/68">“{item.voice.sampleLine}”</p>
                <div className="mt-4 space-y-2 text-sm text-ink/62">
                  <p>
                    <span className="font-semibold text-ink">Bias:</span> {item.voice.worldviewBiases[0]}
                  </p>
                  <p>
                    <span className="font-semibold text-ink">Angle:</span> {item.voice.recurringAngles[0]}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <AudioRenderPanel episodeId={episode.id} audioUrl={episode.audioUrl} />
          <ExportPackagePanel
            episodeId={episode.id}
            exportPackageUrl={episode.exportPackageUrl}
          />
        </aside>
      </section>
    </AppShell>
  );
}
