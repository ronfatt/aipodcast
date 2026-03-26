import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { renderShowAudioPreview, ShowAudioPreviewKind } from "@/lib/audio-renderer";
import { getShowById } from "@/lib/show-store";

function isPreviewKind(value: string): value is ShowAudioPreviewKind {
  return value === "intro" || value === "bed" || value === "outro";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (process.env.ENABLE_SUPABASE_AUTH === "true" && !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { kind?: string };
  const kind = body.kind || "intro";

  if (!isPreviewKind(kind)) {
    return NextResponse.json({ error: "Unsupported preview kind." }, { status: 400 });
  }

  const show = await getShowById(id, user?.id);

  if (!show) {
    return NextResponse.json({ error: "Show not found." }, { status: 404 });
  }

  try {
    const result = await renderShowAudioPreview(show, kind);
    return NextResponse.json({
      audioUrl: result.audioUrl,
      kind,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Preview rendering failed.",
      },
      { status: 500 },
    );
  }
}
