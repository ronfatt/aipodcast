import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { ensureLocalDir, isSupabaseStorageEnabled, uploadFileToStorage } from "@/lib/storage";
import { Episode, ScriptTurn, VoiceProfile } from "@/lib/types";

const execFileAsync = promisify(execFile);
const publicDir = path.join(process.cwd(), "public");
const outputDir = path.join(publicDir, "generated-audio");
const scratchRoot = path.join(process.cwd(), ".tmp-audio");

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function speakerVoice(turn: ScriptTurn, hostA: VoiceProfile, hostB: VoiceProfile) {
  return turn.speaker === "A" ? hostA.systemVoice : hostB.systemVoice;
}

async function synthesizeTurnAudio(filePath: string, text: string, voice: string) {
  await execFileAsync("/usr/bin/say", ["-v", voice, "-o", filePath, text]);
}

async function createPauseFile(filePath: string) {
  await execFileAsync("/opt/homebrew/bin/ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=22050:cl=mono",
    "-t",
    "0.35",
    filePath,
  ]);
}

async function stitchToMp3(inputFiles: string[], outputFile: string) {
  const concatArgs = inputFiles.flatMap((file) => ["-i", file]);
  const filter = `concat=n=${inputFiles.length}:v=0:a=1[out]`;

  await execFileAsync("/opt/homebrew/bin/ffmpeg", [
    "-y",
    ...concatArgs,
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    "-ar",
    "44100",
    "-ac",
    "1",
    "-b:a",
    "128k",
    outputFile,
  ]);
}

export async function renderEpisodeAudio(episode: Episode) {
  const slug = `${sanitizeSegment(episode.showName)}-${sanitizeSegment(episode.id)}`;
  const scratchDir = path.join(scratchRoot, slug);
  const outputFile = path.join(outputDir, `${slug}.mp3`);
  const publicUrl = `/generated-audio/${slug}.mp3`;

  await ensureLocalDir(outputDir);
  await rm(scratchDir, { recursive: true, force: true });
  await mkdir(scratchDir, { recursive: true });

  const pauseFile = path.join(scratchDir, "pause.wav");
  await createPauseFile(pauseFile);

  const renderInputs: string[] = [];

  for (const [index, turn] of episode.script.entries()) {
    const turnFile = path.join(scratchDir, `${index.toString().padStart(2, "0")}-${turn.speaker}.aiff`);
    await synthesizeTurnAudio(turnFile, turn.text, speakerVoice(turn, episode.hostA, episode.hostB));
    renderInputs.push(turnFile);

    if (index < episode.script.length - 1) {
      renderInputs.push(pauseFile);
    }
  }

  await stitchToMp3(renderInputs, outputFile);

  const manifest = {
    episodeId: episode.id,
    title: episode.title,
    generatedAt: new Date().toISOString(),
    audioUrl: publicUrl,
    turns: episode.script.length,
  };

  await writeFile(path.join(scratchDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  if (isSupabaseStorageEnabled()) {
    const uploaded = await uploadFileToStorage(outputFile, `audio/${slug}.mp3`, "audio/mpeg");

    return {
      audioUrl: uploaded.publicUrl,
      outputFile,
    };
  }

  return {
    audioUrl: publicUrl,
    outputFile,
  };
}
