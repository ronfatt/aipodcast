import { NextResponse } from "next/server";
import { scoreTopicIdea } from "@/lib/script-generator";
import { CreateEpisodeInput } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CreateEpisodeInput>;
  const input = {
    showName: body.showName?.trim() || "Future Banter",
    showId: body.showId?.trim() || undefined,
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

  if (!input.topic && !input.sourceNotes) {
    return NextResponse.json({ error: "Please provide a topic or source notes." }, { status: 400 });
  }

  const scored = await scoreTopicIdea(input);

  return NextResponse.json(scored);
}
