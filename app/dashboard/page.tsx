import { AppShell } from "@/components/app-shell";
import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { requireUser } from "@/lib/auth-server";
import { listEpisodes } from "@/lib/episode-store";

export default async function DashboardPage() {
  const user = await requireUser();
  const episodes = await listEpisodes(user?.id);

  return (
    <AppShell title="Dashboard" kicker="Studio Overview">
      <DashboardWorkspace episodes={episodes} />
    </AppShell>
  );
}
