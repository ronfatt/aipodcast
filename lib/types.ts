export type EpisodeStatus =
  | "draft"
  | "script_ready"
  | "audio_rendering"
  | "audio_ready";

export type SourceType = "topic" | "article";

export type HostRole =
  | "strategist"
  | "challenger"
  | "observer"
  | "synthesizer";

export type PersonaMode =
  | "reality-mode"
  | "insight-mode"
  | "custom";

export type ConflictLevel = "low" | "medium" | "high";

export type VoiceProfile = {
  id: string;
  name: string;
  role: HostRole;
  persona: string;
  style: string;
  sampleLine: string;
  systemVoice: string;
  personality: string[];
  speakingStyle: string[];
  signaturePhrases: string[];
  conversationGoals: string[];
  constraints: string[];
  worldviewBiases: string[];
  recurringAngles: string[];
  bannedPhrases: string[];
};

export type ScriptTurn = {
  id: string;
  speaker: "A" | "B";
  text: string;
};

export type HostEpisodeMemory = {
  title: string;
  summary: string;
  sampleLines: string[];
};

export type EpisodeGenerationMemory = {
  hostA: HostEpisodeMemory[];
  hostB: HostEpisodeMemory[];
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
  personaMode?: PersonaMode;
  conflictLevel?: ConflictLevel;
};

export type CreateEpisodesRequest = CreateEpisodeInput & {
  batchTopics?: string[];
};

export type UpdateEpisodeInput = {
  title: string;
  summary: string;
  showNotes: string[];
  cta: string;
  script: ScriptTurn[];
};
