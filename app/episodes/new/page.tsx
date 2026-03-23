import { AppShell } from "@/components/app-shell";
import { NewEpisodeForm } from "@/components/new-episode-form";
import { requireUser } from "@/lib/auth-server";

export default async function NewEpisodePage() {
  await requireUser();
  return (
    <AppShell title="Create Episode" kicker="Source To Script">
      <NewEpisodeForm />
    </AppShell>
  );
}
