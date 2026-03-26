import { AppShell } from "@/components/app-shell";
import { NewEpisodeForm } from "@/components/new-episode-form";
import { requireUser } from "@/lib/auth-server";
import { listShows } from "@/lib/show-store";

export default async function NewEpisodePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const shows = await listShows(user?.id);
  const params = await searchParams;

  const prefills = {
    showId: typeof params?.showId === "string" ? params.showId : undefined,
    showName: typeof params?.showName === "string" ? params.showName : undefined,
    recommendationId:
      typeof params?.recommendationId === "string" ? params.recommendationId : undefined,
    recommendationTitle:
      typeof params?.recommendationTitle === "string" ? params.recommendationTitle : undefined,
    topic: typeof params?.topic === "string" ? params.topic : undefined,
    sourceNotes: typeof params?.sourceNotes === "string" ? params.sourceNotes : undefined,
    template: typeof params?.template === "string" ? params.template : undefined,
    hostAId: typeof params?.hostAId === "string" ? params.hostAId : undefined,
    hostBId: typeof params?.hostBId === "string" ? params.hostBId : undefined,
    personaMode: typeof params?.personaMode === "string" ? params.personaMode : undefined,
    conflictLevel: typeof params?.conflictLevel === "string" ? params.conflictLevel : undefined,
  };

  return (
    <AppShell title="Create Episode" kicker="Source To Script">
      <NewEpisodeForm shows={shows} prefills={prefills} />
    </AppShell>
  );
}
