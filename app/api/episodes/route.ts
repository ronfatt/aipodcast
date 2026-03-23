import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { createEpisode } from "@/lib/episode-store";
import { CreateEpisodeInput } from "@/lib/types";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (process.env.ENABLE_SUPABASE_AUTH === "true" && !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as Partial<CreateEpisodeInput>;

  if (!body.topic?.trim() && !body.sourceNotes?.trim()) {
    return badRequest("Please provide a topic or source notes.");
  }

  const episode = await createEpisode({
    showName: body.showName?.trim() || "Future Banter",
    topic: body.topic?.trim() || "",
    sourceNotes: body.sourceNotes?.trim() || "",
    template: body.template?.trim() || "news-breakdown",
    hostAId: body.hostAId?.trim() || "host-lin",
    hostBId: body.hostBId?.trim() || "host-jay",
  }, user?.id);

  return NextResponse.json({
    episodeId: episode.id,
    generationMode: episode.generationMode ?? "fallback",
  });
}
