export type EpisodeStatus =
  | "draft"
  | "script_ready"
  | "audio_rendering"
  | "audio_ready";

export type SourceType = "topic" | "article";

export type VoiceProfile = {
  id: string;
  name: string;
  persona: string;
  style: string;
  sampleLine: string;
  systemVoice: string;
};

export type ScriptTurn = {
  id: string;
  speaker: "A" | "B";
  text: string;
};

export type Episode = {
  id: string;
  userId?: string;
  title: string;
  showName: string;
  summary: string;
  showNotes: string[];
  cta: string;
  sourceType: SourceType;
  sourceContent: string;
  template: string;
  durationLabel: string;
  status: EpisodeStatus;
  updatedAt: string;
  hostA: VoiceProfile;
  hostB: VoiceProfile;
  script: ScriptTurn[];
  audioUrl?: string;
  exportPackageUrl?: string;
  generationMode?: "fallback" | "openai";
};

export type CreateEpisodeInput = {
  showName: string;
  topic: string;
  sourceNotes: string;
  template: string;
  hostAId: string;
  hostBId: string;
};

export type UpdateEpisodeInput = {
  title: string;
  summary: string;
  showNotes: string[];
  cta: string;
  script: ScriptTurn[];
};
