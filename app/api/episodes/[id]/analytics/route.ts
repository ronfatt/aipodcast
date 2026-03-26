import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getEpisodeById, updateEpisodeAnalytics } from "@/lib/episode-store";
import { UpdateEpisodeAnalyticsInput } from "@/lib/types";

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (process.env.ENABLE_SUPABASE_AUTH === "true" && !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getEpisodeById(id, user?.id);

  if (!existing) {
    return NextResponse.json({ error: "Episode not found." }, { status: 404 });
  }

  const body = (await request.json()) as Partial<UpdateEpisodeAnalyticsInput>;
  const updated = await updateEpisodeAnalytics(
    id,
    {
      publishingPlatform: body.publishingPlatform,
      selectedTitleStyle: body.selectedTitleStyle,
      metrics: {
        impressions: normalizeNumber(body.metrics?.impressions),
        clicks: normalizeNumber(body.metrics?.clicks),
        listens: normalizeNumber(body.metrics?.listens),
        completionRate: Math.max(0, Math.min(100, normalizeNumber(body.metrics?.completionRate))),
        saves: normalizeNumber(body.metrics?.saves),
        shares: normalizeNumber(body.metrics?.shares),
        bestPerformingClipId: body.metrics?.bestPerformingClipId?.trim() || undefined,
      },
    },
    user?.id,
  );

  if (!updated) {
    return NextResponse.json({ error: "Failed to update analytics." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
