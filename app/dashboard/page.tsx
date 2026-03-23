import { AppShell } from "@/components/app-shell";
import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { requireUser } from "@/lib/auth-server";
import { listEpisodes } from "@/lib/episode-store";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ created?: string }>;
}) {
  const user = await requireUser();
  const episodes = await listEpisodes(user?.id);
  const params = await searchParams;
  const createdCount = Number(params?.created ?? "0");

  return (
    <AppShell title="Dashboard" kicker="Studio Overview">
      <DashboardWorkspace episodes={episodes} createdCount={createdCount} />
    </AppShell>
  );
}
