import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { ensureLocalDir, isSupabaseStorageEnabled, uploadFileToStorage } from "@/lib/storage";
import { Episode } from "@/lib/types";

const execFileAsync = promisify(execFile);
const publicDir = path.join(process.cwd(), "public");
const packageDir = path.join(publicDir, "generated-packages");
const scratchRoot = path.join(process.cwd(), ".tmp-export");

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function buildMetadata(episode: Episode) {
  return {
    id: episode.id,
    title: episode.title,
    showName: episode.showName,
    summary: episode.summary,
    durationLabel: episode.durationLabel,
    template: episode.template,
    sourceType: episode.sourceType,
    generationMode: episode.generationMode ?? "fallback",
    audioUrl: episode.audioUrl ?? null,
    generatedAt: new Date().toISOString(),
  };
}

function buildDescription(episode: Episode) {
  return [
    episode.summary,
    "",
    "Show Notes",
    ...episode.showNotes.map((note, index) => `${index + 1}. ${note}`),
    "",
    "CTA",
    episode.cta,
  ].join("\n");
}

export async function createEpisodeExportPackage(episode: Episode, audioFilePath: string) {
  const slug = `${sanitizeSegment(episode.showName)}-${sanitizeSegment(episode.id)}`;
  const workingDir = path.join(scratchRoot, slug);
  const zipFilePath = path.join(packageDir, `${slug}.zip`);
  const publicUrl = `/generated-packages/${slug}.zip`;
  const audioTarget = path.join(workingDir, `${slug}.mp3`);

  await ensureLocalDir(packageDir);
  await rm(workingDir, { recursive: true, force: true });
  await mkdir(workingDir, { recursive: true });

  await copyFile(audioFilePath, audioTarget);
  await writeFile(path.join(workingDir, "title.txt"), `${episode.title}\n`, "utf8");
  await writeFile(path.join(workingDir, "summary.txt"), `${episode.summary}\n`, "utf8");
  await writeFile(path.join(workingDir, "show-notes.txt"), `${episode.showNotes.join("\n")}\n`, "utf8");
  await writeFile(path.join(workingDir, "cta.txt"), `${episode.cta}\n`, "utf8");
  await writeFile(path.join(workingDir, "description.txt"), `${buildDescription(episode)}\n`, "utf8");
  await writeFile(
    path.join(workingDir, "metadata.json"),
    `${JSON.stringify(buildMetadata(episode), null, 2)}\n`,
    "utf8",
  );

  await execFileAsync("/usr/bin/zip", ["-j", "-r", zipFilePath, workingDir]);

  if (isSupabaseStorageEnabled()) {
    const uploaded = await uploadFileToStorage(
      zipFilePath,
      `packages/${slug}.zip`,
      "application/zip",
    );

    return {
      packageUrl: uploaded.publicUrl,
      zipFilePath,
    };
  }

  return {
    packageUrl: publicUrl,
    zipFilePath,
  };
}
