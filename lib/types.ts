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
export type BackgroundMusicLevel = "subtle" | "balanced" | "forward";
export type ScriptSegmentLabel =
  | "hook"
  | "setup"
  | "first_clash"
  | "reality_check"
  | "concrete_example"
  | "reframe"
  | "final_takeaway"
  | "clip_line";

export type ShowProfile = {
  id: string;
  name: string;
  tagline: string;
  category: string;
  coverImageUrl?: string;
  format: string;
  audience: string;
  publishingCadence: string;
  introStyle: string;
  outroStyle: string;
  defaultIntro?: string;
  defaultOutro?: string;
  defaultDescription?: string;
  backgroundMusicUrl?: string;
  backgroundMusicLevel?: BackgroundMusicLevel;
  introStingUrl?: string;
  outroStingUrl?: string;
  template: string;
  personaMode: PersonaMode;
  conflictLevel: ConflictLevel;
  hostAId: string;
  hostBId: string;
};

export type Show = ShowProfile & {
  userId?: string;
  updatedAt: string;
};

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
  segment?: ScriptSegmentLabel;
  text: string;
};

export type TopicScore = {
  controversyScore: number;
  relevanceScore: number;
  audiencePainScore: number;
  clipabilityScore: number;
  monetizationScore: number;
  hookScore: number;
  overallScore: number;
  rationale: string;
};

export type EpisodeClipTag =
  | "debate"
  | "insight"
  | "controversial"
  | "emotional"
  | "practical";

export type EpisodeVariantStyle =
  | "aggressive"
  | "curiosity"
  | "authority"
  | "emotional"
  | "practical";

export type PublishingPlatform =
  | "spotify"
  | "apple-podcasts"
  | "xiaoyuzhou"
  | "youtube"
  | "rss"
  | "other";

export type EpisodeClip = {
  id: string;
  clipTitle: string;
  hookLine: string;
  startSegment: ScriptSegmentLabel;
  endSegment: ScriptSegmentLabel;
  whyItWorks: string;
  shortCaption: string;
  tags: EpisodeClipTag[];
};

export type EpisodeTextVariant = {
  id: string;
  style: EpisodeVariantStyle;
  text: string;
};

export type EpisodeVariantBundle = {
  titles: EpisodeTextVariant[];
  hookLines: EpisodeTextVariant[];
  ctas: EpisodeTextVariant[];
  socialCaptions: EpisodeTextVariant[];
  thumbnailTexts: EpisodeTextVariant[];
};

export type EpisodeAnalytics = {
  hostPair: string;
  conflictLevel: ConflictLevel;
  templateType: string;
  numberOfClipLines: number;
  publishingPlatform?: PublishingPlatform;
  selectedTitleStyle?: EpisodeVariantStyle;
  metrics: {
    impressions: number;
    clicks: number;
    listens: number;
    completionRate: number;
    saves: number;
    shares: number;
    bestPerformingClipId?: string;
  };
};

export type OptimizationRecommendation = {
  id: string;
  title: string;
  rationale: string;
  action: string;
  priority: "high" | "medium" | "low";
  actionLabel?: string;
  actionHref?: string;
};

export type AppliedRecommendation = {
  id: string;
  title: string;
  appliedAt: string;
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
  showId?: string;
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
  topicScore?: TopicScore;
  topicRewrites?: string[];
  clips?: EpisodeClip[];
  variants?: EpisodeVariantBundle;
  analytics?: EpisodeAnalytics;
  appliedRecommendation?: AppliedRecommendation;
  hostA: VoiceProfile;
  hostB: VoiceProfile;
  script: ScriptTurn[];
  audioUrl?: string;
  exportPackageUrl?: string;
  generationMode?: "fallback" | "openai";
};

export type CreateEpisodeInput = {
  showName: string;
  showId?: string;
  showProfileId?: string;
  recommendationId?: string;
  recommendationTitle?: string;
  showTagline?: string;
  showCoverImageUrl?: string;
  targetAudience?: string;
  showFormat?: string;
  introStyle?: string;
  outroStyle?: string;
  defaultIntro?: string;
  defaultOutro?: string;
  defaultDescription?: string;
  topic: string;
  sourceNotes: string;
  template: string;
  hostAId: string;
  hostBId: string;
  personaMode?: PersonaMode;
  conflictLevel?: ConflictLevel;
  approvedTopicScore?: TopicScore;
  approvedTopicRewrites?: string[];
};

export type CreateShowInput = Omit<ShowProfile, "id">;

export type CreateEpisodesRequest = CreateEpisodeInput & {
  batchTopics?: string[];
};

export type TopicScoringResult = {
  topicScore: TopicScore;
  rewrites: string[];
  approved: boolean;
};

export type UpdateEpisodeInput = {
  title: string;
  summary: string;
  showNotes: string[];
  cta: string;
  script: ScriptTurn[];
};

export type UpdateEpisodeAnalyticsInput = {
  publishingPlatform?: PublishingPlatform;
  selectedTitleStyle?: EpisodeVariantStyle;
  metrics: {
    impressions: number;
    clicks: number;
    listens: number;
    completionRate: number;
    saves: number;
    shares: number;
    bestPerformingClipId?: string;
  };
};
