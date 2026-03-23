# AIPodcast

An MVP workspace for building an AI-powered two-host podcast generator.

## Current scope

- Landing page that communicates the product thesis
- Dashboard with sample episodes
- New episode page for source input, template selection, and host setup
- Working text-generation flow from `topic/source notes -> generated script`
- OpenAI-backed script generation when `OPENAI_API_KEY` is configured
- OpenAI TTS audio rendering for deployed environments, with local macOS voice fallback in development
- Episode detail page for script preview, voice configuration, and mp3 export
- Publishing package export with `mp3 + title + summary + show notes + CTA + metadata`
- Product plan document in `docs/product-plan-v1.md`

## Product direction

The first version is focused on a single job:

Turn a topic or long article into an editable two-host script, then render it into a podcast-ready audio file for manual upload to external platforms.

## Suggested next steps

1. Persist episodes so generated drafts survive server restarts.
2. Add real persistence for shows, episodes, and voice profiles.
3. Add richer voice controls and provider selection for production audio.
4. Add export flows for `title`, `show notes`, and platform publishing metadata.

## Environment

Copy `.env.example` to `.env.local` and set:

- `OPENAI_API_KEY` for real script generation
- `OPENAI_SCRIPT_MODEL` if you want to override the default script model
- `OPENAI_TTS_MODEL` if you want to override the default speech model (`gpt-4o-mini-tts`)
- `NEXT_PUBLIC_SUPABASE_URL` for database access
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client-side Supabase configuration
- `SUPABASE_SERVICE_ROLE_KEY` for server-side episode persistence
- `SUPABASE_STORAGE_BUCKET` optional override for audio/package uploads, defaults to `episode-assets`
- `ENABLE_SUPABASE_AUTH` set to `true` only when you want magic-link login and per-user isolation enabled
