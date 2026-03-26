import { sampleEpisodes, voiceProfiles } from "@/lib/mock-data";
import { generateEpisodeFromInput, scoreTopicIdea } from "@/lib/script-generator";
import { hasSupabaseConfig, getSupabaseAdminClient } from "@/lib/supabase";
import { deleteStorageObjectFromUrl } from "@/lib/storage";
import {
  CreateEpisodeInput,
  Episode,
  EpisodeGenerationMemory,
  HostEpisodeMemory,
  UpdateEpisodeAnalyticsInput,
  UpdateEpisodeInput,
} from "@/lib/types";

type EpisodeRow = {
  id: string;
  user_id: string | null;
  show_id?: string | null;
  topic_score?: Episode["topicScore"] | null;
  topic_rewrites?: string[] | null;
  clips?: Episode["clips"] | null;
  variants?: Episode["variants"] | null;
  analytics?: Episode["analytics"] | null;
  applied_recommendation?: Episode["appliedRecommendation"] | null;
  title: string;
  show_name: string;
  summary: string;
  show_notes: string[];
  cta: string;
  source_type: Episode["sourceType"];
  source_content: string;
  template: string;
  duration_label: string;
  status: Episode["status"];
  updated_at: string;
  host_a: Episode["hostA"];
  host_b: Episode["hostB"];
  script: Episode["script"];
  audio_url: string | null;
  export_package_url: string | null;
  generation_mode: Episode["generationMode"] | null;
};

const globalStore = globalThis as typeof globalThis & {
  __episodeStore?: Map<string, Episode>;
};

function getFallbackStore() {
  if (!globalStore.__episodeStore) {
    globalStore.__episodeStore = new Map(
      sampleEpisodes.map((episode) => [episode.id, episode] as const),
    );
  }

  return globalStore.__episodeStore;
}

function mapEpisodeToRow(episode: Episode, options?: { includeShowId?: boolean }): EpisodeRow {
  const includeShowId = options?.includeShowId ?? true;
  return {
    id: episode.id,
    user_id: episode.userId ?? null,
    ...(includeShowId ? { show_id: episode.showId ?? null } : {}),
    topic_score: episode.topicScore ?? null,
    topic_rewrites: episode.topicRewrites ?? null,
    clips: episode.clips ?? null,
    variants: episode.variants ?? null,
    analytics: episode.analytics ?? null,
    applied_recommendation: episode.appliedRecommendation ?? null,
    title: episode.title,
    show_name: episode.showName,
    summary: episode.summary,
    show_notes: episode.showNotes,
    cta: episode.cta,
    source_type: episode.sourceType,
    source_content: episode.sourceContent,
    template: episode.template,
    duration_label: episode.durationLabel,
    status: episode.status,
    updated_at: episode.updatedAt,
    host_a: episode.hostA,
    host_b: episode.hostB,
    script: episode.script,
    audio_url: episode.audioUrl ?? null,
    export_package_url: episode.exportPackageUrl ?? null,
    generation_mode: episode.generationMode ?? null,
  };
}

function mapRowToEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    showId: row.show_id ?? undefined,
    topicScore: row.topic_score ?? undefined,
    topicRewrites: row.topic_rewrites ?? undefined,
    clips: row.clips ?? undefined,
    variants: row.variants ?? undefined,
    analytics: row.analytics ?? undefined,
    appliedRecommendation: row.applied_recommendation ?? undefined,
    title: row.title,
    showName: row.show_name,
    summary: row.summary,
    showNotes: row.show_notes,
    cta: row.cta,
    sourceType: row.source_type,
    sourceContent: row.source_content,
    template: row.template,
    durationLabel: row.duration_label,
    status: row.status,
    updatedAt: row.updated_at,
    hostA: row.host_a,
    hostB: row.host_b,
    script: row.script,
    audioUrl: row.audio_url ?? undefined,
    exportPackageUrl: row.export_package_url ?? undefined,
    generationMode: row.generation_mode ?? undefined,
  };
}

function buildUpdatedTimestamp() {
  return new Date().toISOString();
}

function normalizeEpisodeSummary(summary: string) {
  return summary.replace(/\s+/g, " ").trim();
}

function buildHostMemoryEntries(episodes: Episode[], hostId: string): HostEpisodeMemory[] {
  return episodes
    .filter((episode) => episode.hostA.id === hostId || episode.hostB.id === hostId)
    .slice(0, 3)
    .map((episode) => {
      const matchingSpeaker = episode.hostA.id === hostId ? "A" : "B";
      const sampleLines = episode.script
        .filter((turn) => turn.speaker === matchingSpeaker)
        .slice(0, 2)
        .map((turn) => turn.text.trim());

      return {
        title: episode.title,
        summary: normalizeEpisodeSummary(episode.summary),
        sampleLines,
      };
    });
}

function buildEpisodeGenerationMemory(
  recentEpisodes: Episode[],
  hostAId: string,
  hostBId: string,
): EpisodeGenerationMemory {
  return {
    hostA: buildHostMemoryEntries(recentEpisodes, hostAId),
    hostB: buildHostMemoryEntries(recentEpisodes, hostBId),
  };
}

async function listEpisodesFromSupabase(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as EpisodeRow[]).map(mapRowToEpisode);
}

async function listAllEpisodesFromSupabase() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as EpisodeRow[]).map(mapRowToEpisode);
}

async function getEpisodeByIdFromSupabase(id: string, userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapRowToEpisode(data as EpisodeRow) : undefined;
}

async function getEpisodeByIdAnyUserFromSupabase(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("episodes").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapRowToEpisode(data as EpisodeRow) : undefined;
}

async function upsertEpisodeToSupabase(episode: Episode) {
  const supabase = getSupabaseAdminClient();
  const row = mapEpisodeToRow(episode);
  let { error } = await supabase.from("episodes").upsert(row as never);

  if (error && isMissingEpisodeColumnsError(error)) {
    const legacyRow = mapEpisodeToRow(episode, { includeShowId: false });
    delete (legacyRow as Partial<EpisodeRow>).topic_score;
    delete (legacyRow as Partial<EpisodeRow>).topic_rewrites;
    delete (legacyRow as Partial<EpisodeRow>).clips;
    delete (legacyRow as Partial<EpisodeRow>).variants;
    delete (legacyRow as Partial<EpisodeRow>).analytics;
    delete (legacyRow as Partial<EpisodeRow>).applied_recommendation;
    ({ error } = await supabase.from("episodes").upsert(legacyRow as never));
  }

  if (error) {
    throw error;
  }
}

function isMissingEpisodeColumnsError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "PGRST204" ||
    candidate.code === "42703" ||
    candidate.message?.includes("show_id") === true ||
    candidate.message?.includes("topic_score") === true ||
    candidate.message?.includes("topic_rewrites") === true ||
    candidate.message?.includes("clips") === true ||
    candidate.message?.includes("variants") === true ||
    candidate.message?.includes("analytics") === true ||
    candidate.message?.includes("applied_recommendation") === true
  );
}

async function deleteEpisodeFromSupabase(id: string, userId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("episodes").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    throw error;
  }
}

async function deleteEpisodeAnyUserFromSupabase(id: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("episodes").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function listEpisodes(userId?: string) {
  if (hasSupabaseConfig()) {
    try {
      return userId ? await listEpisodesFromSupabase(userId) : await listAllEpisodesFromSupabase();
    } catch (error) {
      console.error("Failed to list episodes from Supabase, using fallback store.", error);
    }
  }

  return Array.from(getFallbackStore().values())
    .filter((episode) => (userId ? episode.userId === userId : true))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getEpisodeById(id: string, userId?: string) {
  if (hasSupabaseConfig()) {
    try {
      return userId ? await getEpisodeByIdFromSupabase(id, userId) : await getEpisodeByIdAnyUserFromSupabase(id);
    } catch (error) {
      console.error("Failed to load episode from Supabase, using fallback store.", error);
    }
  }

  const episode = getFallbackStore().get(id);
  if (!episode) {
    return undefined;
  }
  return userId && episode.userId !== userId ? undefined : episode;
}

export async function createEpisode(input: CreateEpisodeInput, userId?: string) {
  const hostA = voiceProfiles.find((voice) => voice.id === input.hostAId) ?? voiceProfiles[0];
  const hostB = voiceProfiles.find((voice) => voice.id === input.hostBId) ?? voiceProfiles[1];
  const recentEpisodes = (await listEpisodes(userId)).slice(0, 12);
  const generationMemory = buildEpisodeGenerationMemory(recentEpisodes, hostA.id, hostB.id);
  const topicScoring =
    input.approvedTopicScore
      ? {
          topicScore: input.approvedTopicScore,
          rewrites: input.approvedTopicRewrites ?? [],
          approved: input.approvedTopicScore.overallScore >= 75,
        }
      : await scoreTopicIdea(input);
  const episode = await generateEpisodeFromInput(input, hostA, hostB, generationMemory);
  const nextEpisode = {
    ...episode,
    userId,
    showId: input.showId,
    topicScore: topicScoring.topicScore,
    topicRewrites: topicScoring.rewrites,
  };

  if (hasSupabaseConfig()) {
    try {
      const persistedEpisode = {
        ...nextEpisode,
        updatedAt: buildUpdatedTimestamp(),
      };
      await upsertEpisodeToSupabase(persistedEpisode);
      return persistedEpisode;
    } catch (error) {
      console.error("Failed to persist episode to Supabase, using fallback store.", error);
    }
  }

  getFallbackStore().set(nextEpisode.id, nextEpisode);

  return nextEpisode;
}

export async function updateEpisodeAudio(id: string, audioUrl: string, userId?: string) {
  const episode = await getEpisodeById(id, userId);

  if (!episode) {
    return undefined;
  }

  const nextEpisode: Episode = {
    ...episode,
    status: "audio_ready",
    audioUrl,
    updatedAt: hasSupabaseConfig() ? buildUpdatedTimestamp() : new Date().toLocaleString("zh-CN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  if (hasSupabaseConfig()) {
    try {
      await upsertEpisodeToSupabase(nextEpisode);
      return nextEpisode;
    } catch (error) {
      console.error("Failed to update audio URL in Supabase, using fallback store.", error);
    }
  }

  getFallbackStore().set(id, nextEpisode);
  return nextEpisode;
}

export async function updateEpisodeExportPackage(id: string, exportPackageUrl: string, userId?: string) {
  const episode = await getEpisodeById(id, userId);

  if (!episode) {
    return undefined;
  }

  const nextEpisode: Episode = {
    ...episode,
    exportPackageUrl,
    updatedAt: hasSupabaseConfig() ? buildUpdatedTimestamp() : new Date().toLocaleString("zh-CN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  if (hasSupabaseConfig()) {
    try {
      await upsertEpisodeToSupabase(nextEpisode);
      return nextEpisode;
    } catch (error) {
      console.error("Failed to update export package in Supabase, using fallback store.", error);
    }
  }

  getFallbackStore().set(id, nextEpisode);
  return nextEpisode;
}

export async function updateEpisode(id: string, input: UpdateEpisodeInput, userId?: string) {
  const episode = await getEpisodeById(id, userId);

  if (!episode) {
    return undefined;
  }

  const scriptChanged = JSON.stringify(episode.script) !== JSON.stringify(input.script);
  const nextEpisode: Episode = {
    ...episode,
    title: input.title,
    summary: input.summary,
    showNotes: input.showNotes,
    cta: input.cta,
    script: input.script,
    exportPackageUrl: undefined,
    audioUrl: scriptChanged ? undefined : episode.audioUrl,
    status: scriptChanged ? "script_ready" : episode.status,
    updatedAt: hasSupabaseConfig() ? buildUpdatedTimestamp() : new Date().toLocaleString("zh-CN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  if (scriptChanged && episode.audioUrl) {
    await deleteStorageObjectFromUrl(episode.audioUrl);
  }

  if (episode.exportPackageUrl) {
    await deleteStorageObjectFromUrl(episode.exportPackageUrl);
  }

  if (hasSupabaseConfig()) {
    try {
      await upsertEpisodeToSupabase(nextEpisode);
      return nextEpisode;
    } catch (error) {
      console.error("Failed to update episode in Supabase, using fallback store.", error);
    }
  }

  getFallbackStore().set(id, nextEpisode);
  return nextEpisode;
}

export async function updateEpisodeAnalytics(
  id: string,
  input: UpdateEpisodeAnalyticsInput,
  userId?: string,
) {
  const episode = await getEpisodeById(id, userId);

  if (!episode) {
    return undefined;
  }

  const nextEpisode: Episode = {
    ...episode,
    analytics: {
      hostPair: episode.analytics?.hostPair ?? `${episode.hostA.name} + ${episode.hostB.name}`,
      conflictLevel: episode.analytics?.conflictLevel ?? "medium",
      templateType: episode.analytics?.templateType ?? episode.template,
      numberOfClipLines: episode.analytics?.numberOfClipLines ?? 0,
      publishingPlatform: input.publishingPlatform,
      selectedTitleStyle: input.selectedTitleStyle,
      metrics: {
        impressions: input.metrics.impressions,
        clicks: input.metrics.clicks,
        listens: input.metrics.listens,
        completionRate: input.metrics.completionRate,
        saves: input.metrics.saves,
        shares: input.metrics.shares,
        bestPerformingClipId: input.metrics.bestPerformingClipId,
      },
    },
    updatedAt: hasSupabaseConfig() ? buildUpdatedTimestamp() : new Date().toLocaleString("zh-CN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  if (hasSupabaseConfig()) {
    try {
      await upsertEpisodeToSupabase(nextEpisode);
      return nextEpisode;
    } catch (error) {
      console.error("Failed to update episode analytics in Supabase, using fallback store.", error);
    }
  }

  getFallbackStore().set(id, nextEpisode);
  return nextEpisode;
}

export async function deleteEpisode(id: string, userId?: string) {
  const episode = await getEpisodeById(id, userId);

  if (!episode) {
    return false;
  }

  await deleteStorageObjectFromUrl(episode.audioUrl);
  await deleteStorageObjectFromUrl(episode.exportPackageUrl);

  if (hasSupabaseConfig()) {
    try {
      if (userId) {
        await deleteEpisodeFromSupabase(id, userId);
      } else {
        await deleteEpisodeAnyUserFromSupabase(id);
      }
      return true;
    } catch (error) {
      console.error("Failed to delete episode from Supabase, using fallback store.", error);
    }
  }

  getFallbackStore().delete(id);
  return true;
}
