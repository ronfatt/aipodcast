import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { createEpisodeClipsPackage } from "@/lib/export-package";
import { getEpisodeById } from "@/lib/episode-store";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (process.env.ENABLE_SUPABASE_AUTH === "true" && !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const episode = await getEpisodeById(id, user?.id);

  if (!episode) {
    return NextResponse.json({ error: "Episode not found." }, { status: 404 });
  }

  if (!episode.clips?.length) {
    return NextResponse.json({ error: "No clips available for this episode yet." }, { status: 400 });
  }

  try {
    const result = await createEpisodeClipsPackage(episode);

    return NextResponse.json({
      packageUrl: result.packageUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Clip package generation failed.",
      },
      { status: 500 },
    );
  }
}
