import { showProfiles } from "@/lib/show-profiles";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase";
import { CreateShowInput, Show } from "@/lib/types";

type ShowRow = {
  id: string;
  user_id: string | null;
  name: string;
  tagline: string;
  category: string;
  cover_image_url?: string | null;
  format: string;
  audience: string;
  publishing_cadence: string;
  intro_style: string;
  outro_style: string;
  default_intro?: string | null;
  default_outro?: string | null;
  default_description?: string | null;
  background_music_url?: string | null;
  background_music_level?: Show["backgroundMusicLevel"] | null;
  intro_sting_url?: string | null;
  outro_sting_url?: string | null;
  template: string;
  persona_mode: Show["personaMode"];
  conflict_level: Show["conflictLevel"];
  host_a_id: string;
  host_b_id: string;
  updated_at: string;
};

const globalStore = globalThis as typeof globalThis & {
  __showStore?: Map<string, Show>;
};

function buildUpdatedTimestamp() {
  return new Date().toISOString();
}

function getFallbackStore() {
  if (!globalStore.__showStore) {
    globalStore.__showStore = new Map(
      showProfiles.map((profile) => [
        profile.id,
        {
          ...profile,
          updatedAt: "2026-03-26T00:00:00.000Z",
        } satisfies Show,
      ]),
    );
  }

  return globalStore.__showStore;
}

function mapRowToShow(row: ShowRow): Show {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    name: row.name,
    tagline: row.tagline,
    category: row.category,
    coverImageUrl: row.cover_image_url ?? undefined,
    format: row.format,
    audience: row.audience,
    publishingCadence: row.publishing_cadence,
    introStyle: row.intro_style,
    outroStyle: row.outro_style,
    defaultIntro: row.default_intro ?? undefined,
    defaultOutro: row.default_outro ?? undefined,
    defaultDescription: row.default_description ?? undefined,
    backgroundMusicUrl: row.background_music_url ?? undefined,
    backgroundMusicLevel: row.background_music_level ?? undefined,
    introStingUrl: row.intro_sting_url ?? undefined,
    outroStingUrl: row.outro_sting_url ?? undefined,
    template: row.template,
    personaMode: row.persona_mode,
    conflictLevel: row.conflict_level,
    hostAId: row.host_a_id,
    hostBId: row.host_b_id,
    updatedAt: row.updated_at,
  };
}

function mapShowToRow(show: Show): ShowRow {
  return {
    id: show.id,
    user_id: show.userId ?? null,
    name: show.name,
    tagline: show.tagline,
    category: show.category,
    cover_image_url: show.coverImageUrl ?? null,
    format: show.format,
    audience: show.audience,
    publishing_cadence: show.publishingCadence,
    intro_style: show.introStyle,
    outro_style: show.outroStyle,
    default_intro: show.defaultIntro ?? null,
    default_outro: show.defaultOutro ?? null,
    default_description: show.defaultDescription ?? null,
    background_music_url: show.backgroundMusicUrl ?? null,
    background_music_level: show.backgroundMusicLevel ?? null,
    intro_sting_url: show.introStingUrl ?? null,
    outro_sting_url: show.outroStingUrl ?? null,
    template: show.template,
    persona_mode: show.personaMode,
    conflict_level: show.conflictLevel,
    host_a_id: show.hostAId,
    host_b_id: show.hostBId,
    updated_at: show.updatedAt,
  };
}

function buildShowId(name: string) {
  return `show-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${Date.now().toString(36)}`;
}

async function listShowsFromSupabase(userId?: string) {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("shows").select("*").order("updated_at", { ascending: false });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data as ShowRow[]).map(mapRowToShow);
}

async function upsertShowToSupabase(show: Show) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("shows").upsert(mapShowToRow(show) as never);

  if (error) {
    throw error;
  }
}

export async function listShows(userId?: string) {
  if (hasSupabaseConfig()) {
    try {
      return await listShowsFromSupabase(userId);
    } catch (error) {
      console.error("Failed to list shows from Supabase, using fallback store.", error);
    }
  }

  return Array.from(getFallbackStore().values())
    .filter((show) => (userId ? show.userId === userId : true))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getShowById(id: string, userId?: string) {
  const shows = await listShows(userId);
  return shows.find((show) => show.id === id);
}

export async function createShow(input: CreateShowInput, userId?: string) {
  const nextShow: Show = {
    id: buildShowId(input.name),
    userId,
    ...input,
    updatedAt: buildUpdatedTimestamp(),
  };

  if (hasSupabaseConfig()) {
    try {
      await upsertShowToSupabase(nextShow);
      return nextShow;
    } catch (error) {
      console.error("Failed to persist show to Supabase, using fallback store.", error);
    }
  }

  getFallbackStore().set(nextShow.id, nextShow);
  return nextShow;
}

export async function updateShow(id: string, input: Partial<CreateShowInput>, userId?: string) {
  const existingShow = await getShowById(id, userId);

  if (!existingShow) {
    return undefined;
  }

  const nextShow: Show = {
    ...existingShow,
    ...input,
    updatedAt: buildUpdatedTimestamp(),
  };

  if (hasSupabaseConfig()) {
    try {
      await upsertShowToSupabase(nextShow);
      return nextShow;
    } catch (error) {
      console.error("Failed to update show in Supabase, using fallback store.", error);
    }
  }

  getFallbackStore().set(nextShow.id, nextShow);
  return nextShow;
}
