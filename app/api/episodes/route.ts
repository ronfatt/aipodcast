import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { createEpisode } from "@/lib/episode-store";
import { CreateEpisodeInput, CreateEpisodesRequest } from "@/lib/types";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (process.env.ENABLE_SUPABASE_AUTH === "true" && !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as Partial<CreateEpisodesRequest>;
  const batchTopics = (body.batchTopics ?? [])
    .map((topic) => topic.trim())
    .filter(Boolean);
  const usedBatchMode = batchTopics.length > 0;
  const baseInput = {
    showId: body.showId?.trim() || undefined,
    showName: body.showName?.trim() || "Future Banter",
    showProfileId: body.showProfileId?.trim() || undefined,
    showTagline: body.showTagline?.trim() || undefined,
    showCoverImageUrl: body.showCoverImageUrl?.trim() || undefined,
    targetAudience: body.targetAudience?.trim() || undefined,
    showFormat: body.showFormat?.trim() || undefined,
    introStyle: body.introStyle?.trim() || undefined,
    outroStyle: body.outroStyle?.trim() || undefined,
    defaultIntro: body.defaultIntro?.trim() || undefined,
    defaultOutro: body.defaultOutro?.trim() || undefined,
    defaultDescription: body.defaultDescription?.trim() || undefined,
    topic: body.topic?.trim() || "",
    sourceNotes: body.sourceNotes?.trim() || "",
    template: body.template?.trim() || "news-breakdown",
    hostAId: body.hostAId?.trim() || "host-lin",
    hostBId: body.hostBId?.trim() || "host-jay",
    personaMode: body.personaMode,
    conflictLevel: body.conflictLevel,
  } satisfies CreateEpisodeInput;

  if (!baseInput.topic && !baseInput.sourceNotes && batchTopics.length === 0) {
    return badRequest("Please provide a topic or source notes.");
  }

  if (batchTopics.length > 8) {
    return badRequest("Batch mode supports up to 8 topics at a time.");
  }

  const topicsToCreate = batchTopics.length ? batchTopics : [baseInput.topic || baseInput.sourceNotes];
  const createdEpisodes = [];

  for (const topic of topicsToCreate) {
    const episode = await createEpisode(
      {
        ...baseInput,
        topic,
      },
      user?.id,
    );
    createdEpisodes.push(episode);
  }

  if (usedBatchMode) {
    return NextResponse.json({
      createdCount: createdEpisodes.length,
      episodeIds: createdEpisodes.map((episode) => episode.id),
      generationModes: createdEpisodes.map((episode) => episode.generationMode ?? "fallback"),
    });
  }

  const [episode] = createdEpisodes;

  return NextResponse.json({
    episodeId: episode.id,
    generationMode: episode.generationMode ?? "fallback",
  });
}
