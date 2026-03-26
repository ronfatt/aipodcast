import os from "node:os";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { getOpenAIClient, getTtsModel, hasOpenAIKey } from "@/lib/openai";
import { voiceProfiles } from "@/lib/mock-data";
import { ensureLocalDir, isSupabaseStorageEnabled, uploadFileToStorage } from "@/lib/storage";
import { BackgroundMusicLevel, Episode, Show, VoiceProfile } from "@/lib/types";

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

type RenderSegment = {
  key: string;
  text: string;
  voice: VoiceProfile;
  pauseAfterSeconds: number;
};

type ShowAudioLayerOptions = {
  includeBackgroundMusic?: boolean;
  includeIntroSting?: boolean;
  includeOutroSting?: boolean;
};

export type ShowAudioPreviewKind = "intro" | "bed" | "outro";

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function backgroundMusicGain(level: BackgroundMusicLevel = "subtle") {
  switch (level) {
    case "forward":
      return 0.22;
    case "balanced":
      return 0.14;
    case "subtle":
    default:
      return 0.08;
  }
}

function buildRenderSegments(episode: Episode, show?: Show): RenderSegment[] {
  const segments: RenderSegment[] = [];

  if (show?.defaultIntro?.trim()) {
    segments.push({
      key: "show-intro",
      text: show.defaultIntro.trim(),
      voice: episode.hostA,
      pauseAfterSeconds: 0.6,
    });
  }

  episode.script.forEach((turn, index) => {
    const isLastTurn = index === episode.script.length - 1;
    const hasShowOutro = Boolean(show?.defaultOutro?.trim());

    segments.push({
      key: turn.id,
      text: turn.text,
      voice: turn.speaker === "A" ? episode.hostA : episode.hostB,
      pauseAfterSeconds: isLastTurn && hasShowOutro ? 0.6 : 0.35,
    });
  });

  if (show?.defaultOutro?.trim()) {
    segments.push({
      key: "show-outro",
      text: show.defaultOutro.trim(),
      voice: episode.hostA,
      pauseAfterSeconds: 0,
    });
  }

  return segments;
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

async function createPauseFileWithFfmpeg(filePath: string, seconds: number) {
  await execFileAsync(ffmpegPath, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=22050:cl=mono",
    "-t",
    `${seconds}`,
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

function assertPcm16Mono(wav: WavData, label: string) {
  if (wav.audioFormat !== 1 || wav.bitsPerSample !== 16 || wav.numChannels !== 1) {
    throw new Error(`${label} must be a mono 16-bit PCM WAV file.`);
  }
}

function cloneBuffer(buffer: Buffer) {
  const next = Buffer.alloc(buffer.length);
  buffer.copy(next);
  return next;
}

function scalePcm16(buffer: Buffer, gain: number) {
  const next = Buffer.alloc(buffer.length);

  for (let offset = 0; offset < buffer.length; offset += 2) {
    const sample = buffer.readInt16LE(offset);
    const scaled = Math.max(-32768, Math.min(32767, Math.round(sample * gain)));
    next.writeInt16LE(scaled, offset);
  }

  return next;
}

function loopPcm16ToLength(buffer: Buffer, targetLength: number) {
  if (buffer.length >= targetLength) {
    return buffer.subarray(0, targetLength);
  }

  const next = Buffer.alloc(targetLength);
  let offset = 0;

  while (offset < targetLength) {
    const remaining = targetLength - offset;
    const chunkLength = Math.min(buffer.length, remaining);
    buffer.copy(next, offset, 0, chunkLength);
    offset += chunkLength;
  }

  return next;
}

function mixPcm16(base: Buffer, overlay: Buffer) {
  const length = Math.min(base.length, overlay.length);
  const next = cloneBuffer(base);

  for (let offset = 0; offset < length; offset += 2) {
    const baseSample = next.readInt16LE(offset);
    const overlaySample = overlay.readInt16LE(offset);
    const mixed = Math.max(-32768, Math.min(32767, baseSample + overlaySample));
    next.writeInt16LE(mixed, offset);
  }

  return next;
}

async function fetchAudioAssetBuffer(assetUrl: string) {
  if (assetUrl.startsWith("http://") || assetUrl.startsWith("https://")) {
    const response = await fetch(assetUrl);

    if (!response.ok) {
      throw new Error(`Failed to download audio asset: ${assetUrl}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  if (assetUrl.startsWith("/")) {
    return readFile(path.join(process.cwd(), "public", assetUrl.replace(/^\//, "")));
  }

  return readFile(assetUrl);
}

async function loadWavAsset(assetUrl: string, label: string, reference?: Omit<WavData, "data">) {
  const buffer = await fetchAudioAssetBuffer(assetUrl);
  const wav = parseWav(buffer);
  assertPcm16Mono(wav, label);

  if (
    reference &&
    (wav.audioFormat !== reference.audioFormat ||
      wav.numChannels !== reference.numChannels ||
      wav.sampleRate !== reference.sampleRate ||
      wav.bitsPerSample !== reference.bitsPerSample)
  ) {
    throw new Error(`${label} must match the episode audio sample rate and WAV format.`);
  }

  return wav;
}

async function applyShowAudioLayersToWav(
  voiceWavBuffer: Buffer,
  show?: Show,
  options?: ShowAudioLayerOptions,
) {
  if (!show) {
    return voiceWavBuffer;
  }

  const includeBackgroundMusic = options?.includeBackgroundMusic ?? true;
  const includeIntroSting = options?.includeIntroSting ?? true;
  const includeOutroSting = options?.includeOutroSting ?? true;

  const voiceWav = parseWav(voiceWavBuffer);
  assertPcm16Mono(voiceWav, "Rendered episode audio");

  const format = {
    audioFormat: voiceWav.audioFormat,
    numChannels: voiceWav.numChannels,
    sampleRate: voiceWav.sampleRate,
    byteRate: voiceWav.byteRate,
    blockAlign: voiceWav.blockAlign,
    bitsPerSample: voiceWav.bitsPerSample,
  };

  let bodyData = cloneBuffer(voiceWav.data);

  if (includeBackgroundMusic && show.backgroundMusicUrl?.trim()) {
    const backgroundWav = await loadWavAsset(show.backgroundMusicUrl.trim(), "Background music", format);
    const looped = loopPcm16ToLength(backgroundWav.data, bodyData.length);
    const gained = scalePcm16(looped, backgroundMusicGain(show.backgroundMusicLevel));
    bodyData = mixPcm16(bodyData, gained);
  }

  const bodyBuffer = createWavBuffer(format, bodyData);
  const stitchedSegments: Array<{ audio: Buffer; pauseAfterSeconds: number }> = [];

  if (includeIntroSting && show.introStingUrl?.trim()) {
    const introSting = await loadWavAsset(show.introStingUrl.trim(), "Intro sting", format);
    stitchedSegments.push({
      audio: createWavBuffer(format, introSting.data),
      pauseAfterSeconds: 0.25,
    });
  }

  stitchedSegments.push({
    audio: bodyBuffer,
    pauseAfterSeconds: includeOutroSting && show.outroStingUrl?.trim() ? 0.25 : 0,
  });

  if (includeOutroSting && show.outroStingUrl?.trim()) {
    const outroSting = await loadWavAsset(show.outroStingUrl.trim(), "Outro sting", format);
    stitchedSegments.push({
      audio: createWavBuffer(format, outroSting.data),
      pauseAfterSeconds: 0,
    });
  }

  return combineWavSegments(stitchedSegments);
}

function combineWavSegments(segments: Array<{ audio: Buffer; pauseAfterSeconds: number }>) {
  const parsed = segments.map((segment) => ({
    ...parseWav(segment.audio),
    pauseAfterSeconds: segment.pauseAfterSeconds,
  }));
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
  const combined: Buffer[] = [];

  parsed.forEach((segment, index) => {
    combined.push(segment.data);
    if (index < parsed.length - 1 && segment.pauseAfterSeconds > 0) {
      const pause = createSilenceBuffer(format, segment.pauseAfterSeconds);
      combined.push(pause);
    }
  });

  return createWavBuffer(format, Buffer.concat(combined));
}

async function renderWithOpenAITts(segments: RenderSegment[], outputFile: string) {
  const segmentBuffers: Array<{ audio: Buffer; pauseAfterSeconds: number }> = [];

  for (const segment of segments) {
    const audio = await synthesizeTurnAudioWithOpenAI(segment.text, segment.voice);
    segmentBuffers.push({
      audio,
      pauseAfterSeconds: segment.pauseAfterSeconds,
    });
  }

  const wavBuffer = combineWavSegments(segmentBuffers);
  await writeFile(outputFile, wavBuffer);
}

async function renderSegmentsToOutput(
  segments: RenderSegment[],
  outputFile: string,
  scratchDir: string,
  show?: Show,
  layerOptions?: ShowAudioLayerOptions,
) {
  if (hasOpenAIKey()) {
    try {
      await renderWithOpenAITts(segments, outputFile);

      if (
        show &&
        ((layerOptions?.includeBackgroundMusic ?? true) && show.backgroundMusicUrl?.trim() ||
          (layerOptions?.includeIntroSting ?? true) && show.introStingUrl?.trim() ||
          (layerOptions?.includeOutroSting ?? true) && show.outroStingUrl?.trim())
      ) {
        const renderedBuffer = await readFile(outputFile);
        const layeredBuffer = await applyShowAudioLayersToWav(renderedBuffer, show, layerOptions);
        await writeFile(outputFile, layeredBuffer);
      }
    } catch (error) {
      if (process.platform === "darwin") {
        await renderWithLocalMacVoices(segments, scratchDir, outputFile);
      } else {
        throw new Error(formatTtsProviderError(error));
      }
    }
  } else if (process.platform === "darwin") {
    await renderWithLocalMacVoices(segments, scratchDir, outputFile);
  } else {
    throw new Error(
      "Audio rendering needs OpenAI TTS in this deployment environment. Add OPENAI_API_KEY so the server can render audio online.",
    );
  }
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
  segments: RenderSegment[],
  scratchDir: string,
  outputFile: string,
) {
  const pauseFiles = new Map<string, string>();
  const renderInputs: string[] = [];

  for (const [index, segment] of segments.entries()) {
    const turnFile = path.join(scratchDir, `${index.toString().padStart(2, "0")}-${segment.key}.aiff`);
    await synthesizeTurnAudioWithSay(turnFile, segment.text, segment.voice.systemVoice);
    renderInputs.push(turnFile);

    if (index < segments.length - 1 && segment.pauseAfterSeconds > 0) {
      const pauseKey = segment.pauseAfterSeconds.toFixed(2);
      let pauseFile = pauseFiles.get(pauseKey);

      if (!pauseFile) {
        pauseFile = path.join(scratchDir, `pause-${pauseKey.replace(".", "-")}.wav`);
        await createPauseFileWithFfmpeg(pauseFile, segment.pauseAfterSeconds);
        pauseFiles.set(pauseKey, pauseFile);
      }

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

export async function renderEpisodeAudio(episode: Episode, show?: Show) {
  const slug = `${sanitizeSegment(episode.showName)}-${sanitizeSegment(episode.id)}`;
  const scratchDir = path.join(scratchRoot, slug);
  const outputDir = isSupabaseStorageEnabled() ? transientOutputRoot : persistentOutputDir;
  const output = resolveAudioOutput(slug);
  const outputFile = path.join(outputDir, `${slug}.${output.extension}`);
  const publicUrl = `/generated-audio/${slug}.${output.extension}`;
  const renderSegments = buildRenderSegments(episode, show);

  await ensureLocalDir(outputDir);
  await rm(scratchDir, { recursive: true, force: true });
  await mkdir(scratchDir, { recursive: true });
  await renderSegmentsToOutput(renderSegments, outputFile, scratchDir, show);

  const manifest = {
    episodeId: episode.id,
    title: episode.title,
    generatedAt: new Date().toISOString(),
    audioUrl: publicUrl,
    turns: episode.script.length,
    renderedSegments: renderSegments.length,
    includesShowIntro: Boolean(show?.defaultIntro?.trim()),
    includesShowOutro: Boolean(show?.defaultOutro?.trim()),
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

function getShowPreviewVoice(show: Show) {
  return voiceProfiles.find((voice) => voice.id === show.hostAId) ?? voiceProfiles[0];
}

function buildShowPreviewSegments(show: Show, kind: ShowAudioPreviewKind): RenderSegment[] {
  const hostVoice = getShowPreviewVoice(show);

  if (kind === "intro") {
    return [
      {
        key: "preview-intro",
        text:
          show.defaultIntro?.trim() ||
          `这里是 ${show.name}。${show.tagline || "我们先快速听一下这档节目的开场感觉。"}`,
        voice: hostVoice,
        pauseAfterSeconds: 0,
      },
    ];
  }

  if (kind === "outro") {
    return [
      {
        key: "preview-outro",
        text:
          show.defaultOutro?.trim() ||
          `这里是 ${show.name} 的收尾试听。如果只留下一句话，希望你能记住这档节目的节奏和语气。`,
        voice: hostVoice,
        pauseAfterSeconds: 0,
      },
    ];
  }

  return [
    {
      key: "preview-bed",
      text: `这里是 ${show.name} 的背景音乐试听。我们想确认口播、音乐和节目气质能不能贴在一起。`,
      voice: hostVoice,
      pauseAfterSeconds: 0,
    },
  ];
}

function previewLayerOptions(kind: ShowAudioPreviewKind): ShowAudioLayerOptions {
  switch (kind) {
    case "intro":
      return {
        includeBackgroundMusic: true,
        includeIntroSting: true,
        includeOutroSting: false,
      };
    case "outro":
      return {
        includeBackgroundMusic: true,
        includeIntroSting: false,
        includeOutroSting: true,
      };
    case "bed":
    default:
      return {
        includeBackgroundMusic: true,
        includeIntroSting: false,
        includeOutroSting: false,
      };
  }
}

export async function renderShowAudioPreview(show: Show, kind: ShowAudioPreviewKind) {
  const slug = `${sanitizeSegment(show.name)}-${kind}-preview`;
  const scratchDir = path.join(scratchRoot, slug);
  const outputDir = isSupabaseStorageEnabled() ? transientOutputRoot : persistentOutputDir;
  const outputFile = path.join(outputDir, `${slug}.wav`);
  const publicUrl = `/generated-audio/${slug}.wav`;
  const segments = buildShowPreviewSegments(show, kind);

  await ensureLocalDir(outputDir);
  await rm(scratchDir, { recursive: true, force: true });
  await mkdir(scratchDir, { recursive: true });

  await renderSegmentsToOutput(segments, outputFile, scratchDir, show, previewLayerOptions(kind));

  if (isSupabaseStorageEnabled()) {
    const uploaded = await uploadFileToStorage(outputFile, `show-previews/${slug}.wav`, "audio/wav");

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
