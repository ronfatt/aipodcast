import { AppShell } from "@/components/app-shell";
import { ShowManager } from "@/components/show-manager";
import { requireUser } from "@/lib/auth-server";
import { listShows } from "@/lib/show-store";

export default async function ShowsPage() {
  const user = await requireUser();
  const shows = await listShows(user?.id);

  return (
    <AppShell title="Shows" kicker="Show Library">
      <ShowManager shows={shows} />
    </AppShell>
  );
}
