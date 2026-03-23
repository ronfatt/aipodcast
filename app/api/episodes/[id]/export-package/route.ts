import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { renderEpisodeAudio } from "@/lib/audio-renderer";
import { getEpisodeById, updateEpisodeAudio, updateEpisodeExportPackage } from "@/lib/episode-store";
import { createEpisodeExportPackage } from "@/lib/export-package";

async function resolveAudioFilePath(audioUrl: string, episodeId: string) {
  if (audioUrl.startsWith("/")) {
    return path.join(process.cwd(), "public", audioUrl.replace(/^\//, ""));
  }

  const response = await fetch(audioUrl);

  if (!response.ok) {
    throw new Error("Failed to download remote audio asset.");
  }

  const arrayBuffer = await response.arrayBuffer();
  const tempDir = path.join(os.tmpdir(), "aipodcast-export-downloads");
  await mkdir(tempDir, { recursive: true });
  const extension = path.extname(new URL(audioUrl).pathname) || ".mp3";
  const tempFilePath = path.join(tempDir, `${episodeId}${extension}`);
  await writeFile(tempFilePath, Buffer.from(arrayBuffer));

  return tempFilePath;
}

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
    let audioUrl = episode.audioUrl;
    let audioFilePath = audioUrl ? await resolveAudioFilePath(audioUrl, id) : "";

    if (!audioUrl) {
      const rendered = await renderEpisodeAudio(episode);
      audioUrl = rendered.audioUrl;
      audioFilePath = rendered.outputFile;
      await updateEpisodeAudio(id, rendered.audioUrl, user?.id);
    }

    const result = await createEpisodeExportPackage(
      {
        ...episode,
        audioUrl,
      },
      audioFilePath,
    );

    const updated = await updateEpisodeExportPackage(id, result.packageUrl, user?.id);

    return NextResponse.json({
      packageUrl: updated?.exportPackageUrl ?? result.packageUrl,
      audioUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Export package generation failed.",
      },
      { status: 500 },
    );
  }
}
