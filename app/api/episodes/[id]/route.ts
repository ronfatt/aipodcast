import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { deleteEpisode, getEpisodeById, updateEpisode } from "@/lib/episode-store";
import { UpdateEpisodeInput } from "@/lib/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (process.env.ENABLE_SUPABASE_AUTH === "true" && !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as Partial<UpdateEpisodeInput>;

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  if (!body.summary?.trim()) {
    return NextResponse.json({ error: "Summary is required." }, { status: 400 });
  }

  if (!body.cta?.trim()) {
    return NextResponse.json({ error: "CTA is required." }, { status: 400 });
  }

  if (!body.showNotes?.length) {
    return NextResponse.json({ error: "At least one show note is required." }, { status: 400 });
  }

  if (!body.script?.length) {
    return NextResponse.json({ error: "Script cannot be empty." }, { status: 400 });
  }

  const updated = await updateEpisode(id, {
    title: body.title.trim(),
    summary: body.summary.trim(),
    showNotes: body.showNotes.map((note) => note.trim()).filter(Boolean),
    cta: body.cta.trim(),
    script: body.script.map((turn) => ({
      id: turn.id,
      speaker: turn.speaker,
      text: turn.text.trim(),
    })),
  }, user?.id);

  if (!updated) {
    return NextResponse.json({ error: "Episode not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
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

  await deleteEpisode(id, user?.id);

  return NextResponse.json({ ok: true });
}
