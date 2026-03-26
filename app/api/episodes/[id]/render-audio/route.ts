import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { renderEpisodeAudio } from "@/lib/audio-renderer";
import { getEpisodeById, updateEpisodeAudio } from "@/lib/episode-store";
import { getShowById, listShows } from "@/lib/show-store";

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

  try {
    const show =
      (episode.showId ? await getShowById(episode.showId, user?.id) : undefined) ||
      (await listShows(user?.id)).find((item) => item.name === episode.showName);
    const result = await renderEpisodeAudio(episode, show);
    const updated = await updateEpisodeAudio(id, result.audioUrl, user?.id);

    return NextResponse.json({
      audioUrl: updated?.audioUrl ?? result.audioUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audio rendering failed.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
