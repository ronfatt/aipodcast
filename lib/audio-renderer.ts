import os from "node:os";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { getOpenAIClient, getTtsModel, hasOpenAIKey } from "@/lib/openai";
import { ensureLocalDir, isSupabaseStorageEnabled, uploadFileToStorage } from "@/lib/storage";
import { Episode, ScriptTurn, VoiceProfile } from "@/lib/types";

const execFileAsync = promisify(execFile);
const publicDir = path.join(process.cwd(), "public");
const persistentOutputDir = path.join(publicDir, "generated-audio");
const scratchRoot = path.join(os.tmpdir(), "aipodcast-audio");
const transientOutputRoot = path.join(os.tmpdir(), "aipodcast-output");
const ffmpegPath = process.platform === "darwin" ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg";

type WavData = {
  audioFormat: number;
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
  data: Buffer;
};

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

function getOpenAITtsVoice(voice: VoiceProfile) {
  switch (voice.role) {
    case "strategist":
      return "sage";
    case "challenger":
      return "ash";
    case "observer":
      return "coral";
    case "synthesizer":
      return "verse";
  }
}

function buildOpenAITtsInstructions(voice: VoiceProfile) {
  return [
    `Speak in Mandarin Chinese as ${voice.name}.`,
    `Persona: ${voice.persona}.`,
    `Style: ${voice.style}.`,
    `Speaking style: ${voice.speakingStyle.join(", ")}.`,
    `Recurring angles: ${voice.recurringAngles.join(", ")}.`,
    `Avoid phrases: ${voice.bannedPhrases.join(", ")}.`,
    "Keep the delivery natural, podcast-like, and conversational.",
  ].join(" ");
}

async function synthesizeTurnAudioWithSay(filePath: string, text: string, voice: string) {
  await execFileAsync("/usr/bin/say", ["-v", voice, "-o", filePath, text]);
}

async function createPauseFileWithFfmpeg(filePath: string) {
  await execFileAsync(ffmpegPath, [
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

async function stitchToMp3WithFfmpeg(inputFiles: string[], outputFile: string) {
  const concatArgs = inputFiles.flatMap((file) => ["-i", file]);
  const filter = `concat=n=${inputFiles.length}:v=0:a=1[out]`;

  await execFileAsync(ffmpegPath, [
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

async function synthesizeTurnAudioWithOpenAI(text: string, voice: VoiceProfile) {
  const client = getOpenAIClient();
  const response = await client.audio.speech.create({
    model: getTtsModel(),
    voice: getOpenAITtsVoice(voice),
    input: text,
    response_format: "wav",
    instructions: buildOpenAITtsInstructions(voice),
  });

  return Buffer.from(await response.arrayBuffer());
}

function readAscii(buffer: Buffer, start: number, length: number) {
  return buffer.toString("ascii", start, start + length);
}

function parseWav(buffer: Buffer): WavData {
  if (readAscii(buffer, 0, 4) !== "RIFF" || readAscii(buffer, 8, 4) !== "WAVE") {
    throw new Error("Unsupported WAV format returned by TTS provider.");
  }

  let offset = 12;
  let fmt: Omit<WavData, "data"> | null = null;
  let data: Buffer | null = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = readAscii(buffer, offset, 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;

    if (chunkId === "fmt ") {
      fmt = {
        audioFormat: buffer.readUInt16LE(chunkStart),
        numChannels: buffer.readUInt16LE(chunkStart + 2),
        sampleRate: buffer.readUInt32LE(chunkStart + 4),
        byteRate: buffer.readUInt32LE(chunkStart + 8),
        blockAlign: buffer.readUInt16LE(chunkStart + 12),
        bitsPerSample: buffer.readUInt16LE(chunkStart + 14),
      };
    }

    if (chunkId === "data") {
      data = buffer.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (!fmt || !data) {
    throw new Error("Incomplete WAV data returned by TTS provider.");
  }

  return {
    ...fmt,
    data,
  };
}

function createWavBuffer(format: Omit<WavData, "data">, data: Buffer) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(format.audioFormat, 20);
  header.writeUInt16LE(format.numChannels, 22);
  header.writeUInt32LE(format.sampleRate, 24);
  header.writeUInt32LE(format.byteRate, 28);
  header.writeUInt16LE(format.blockAlign, 32);
  header.writeUInt16LE(format.bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}

function createSilenceBuffer(format: Omit<WavData, "data">, seconds: number) {
  const byteLength = Math.round(format.byteRate * seconds);
  return Buffer.alloc(byteLength);
}

function combineWavSegments(segments: Buffer[], pauseSeconds = 0.35) {
  const parsed = segments.map(parseWav);
  const [first] = parsed;

  if (!first) {
    throw new Error("No audio segments were generated.");
  }

  for (const segment of parsed.slice(1)) {
    if (
      segment.audioFormat !== first.audioFormat ||
      segment.numChannels !== first.numChannels ||
      segment.sampleRate !== first.sampleRate ||
      segment.bitsPerSample !== first.bitsPerSample
    ) {
      throw new Error("TTS segments returned incompatible audio formats.");
    }
  }

  const format = {
    audioFormat: first.audioFormat,
    numChannels: first.numChannels,
    sampleRate: first.sampleRate,
    byteRate: first.byteRate,
    blockAlign: first.blockAlign,
    bitsPerSample: first.bitsPerSample,
  };
  const pause = createSilenceBuffer(format, pauseSeconds);
  const combined: Buffer[] = [];

  parsed.forEach((segment, index) => {
    combined.push(segment.data);
    if (index < parsed.length - 1) {
      combined.push(pause);
    }
  });

  return createWavBuffer(format, Buffer.concat(combined));
}

async function renderWithOpenAITts(episode: Episode, outputFile: string) {
  const segmentBuffers: Buffer[] = [];

  for (const turn of episode.script) {
    const voice = turn.speaker === "A" ? episode.hostA : episode.hostB;
    const audio = await synthesizeTurnAudioWithOpenAI(turn.text, voice);
    segmentBuffers.push(audio);
  }

  const wavBuffer = combineWavSegments(segmentBuffers);
  await writeFile(outputFile, wavBuffer);
}

function formatTtsProviderError(error: unknown) {
  if (!(error instanceof Error)) {
    return "OpenAI TTS failed.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("insufficient_quota") || message.includes("current quota")) {
    return "OpenAI TTS is configured, but the API key has no remaining audio quota right now. Please check billing or switch to a funded key.";
  }

  return error.message;
}

async function renderWithLocalMacVoices(
  episode: Episode,
  scratchDir: string,
  outputFile: string,
) {
  const pauseFile = path.join(scratchDir, "pause.wav");
  await createPauseFileWithFfmpeg(pauseFile);

  const renderInputs: string[] = [];

  for (const [index, turn] of episode.script.entries()) {
    const turnFile = path.join(scratchDir, `${index.toString().padStart(2, "0")}-${turn.speaker}.aiff`);
    await synthesizeTurnAudioWithSay(turnFile, turn.text, speakerVoice(turn, episode.hostA, episode.hostB));
    renderInputs.push(turnFile);

    if (index < episode.script.length - 1) {
      renderInputs.push(pauseFile);
    }
  }

  await stitchToMp3WithFfmpeg(renderInputs, outputFile);
}

function resolveAudioOutput(slug: string) {
  if (hasOpenAIKey()) {
    return {
      extension: "wav",
      contentType: "audio/wav",
    };
  }

  return {
    extension: "mp3",
    contentType: "audio/mpeg",
  };
}

export async function renderEpisodeAudio(episode: Episode) {
  const slug = `${sanitizeSegment(episode.showName)}-${sanitizeSegment(episode.id)}`;
  const scratchDir = path.join(scratchRoot, slug);
  const outputDir = isSupabaseStorageEnabled() ? transientOutputRoot : persistentOutputDir;
  const output = resolveAudioOutput(slug);
  const outputFile = path.join(outputDir, `${slug}.${output.extension}`);
  const publicUrl = `/generated-audio/${slug}.${output.extension}`;

  await ensureLocalDir(outputDir);
  await rm(scratchDir, { recursive: true, force: true });
  await mkdir(scratchDir, { recursive: true });

  if (hasOpenAIKey()) {
    try {
      await renderWithOpenAITts(episode, outputFile);
    } catch (error) {
      if (process.platform === "darwin") {
        await renderWithLocalMacVoices(episode, scratchDir, outputFile);
      } else {
        throw new Error(formatTtsProviderError(error));
      }
    }
  } else if (process.platform === "darwin") {
    await renderWithLocalMacVoices(episode, scratchDir, outputFile);
  } else {
    throw new Error(
      "Audio rendering needs OpenAI TTS in this deployment environment. Add OPENAI_API_KEY so the server can render audio online.",
    );
  }

  const manifest = {
    episodeId: episode.id,
    title: episode.title,
    generatedAt: new Date().toISOString(),
    audioUrl: publicUrl,
    turns: episode.script.length,
    format: output.extension,
  };

  await writeFile(path.join(scratchDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  if (isSupabaseStorageEnabled()) {
    const uploaded = await uploadFileToStorage(
      outputFile,
      `audio/${slug}.${output.extension}`,
      output.contentType,
    );

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
