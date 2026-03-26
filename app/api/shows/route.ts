import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { createShow, listShows } from "@/lib/show-store";
import { CreateShowInput } from "@/lib/types";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  const user = await getCurrentUser();
  const shows = await listShows(user?.id);

  return NextResponse.json({ shows });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (process.env.ENABLE_SUPABASE_AUTH === "true" && !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as Partial<CreateShowInput>;

  if (!body.name?.trim()) {
    return badRequest("Please provide a show name.");
  }

  const show = await createShow(
    {
      name: body.name.trim(),
      tagline: body.tagline?.trim() || "",
      category: body.category?.trim() || "Custom Show",
      coverImageUrl: body.coverImageUrl?.trim() || undefined,
      format: body.format?.trim() || "8-12 分钟双人对话节目",
      audience: body.audience?.trim() || "General creators",
      publishingCadence: body.publishingCadence?.trim() || "每周更新",
      introStyle: body.introStyle?.trim() || "开场快速说明这集为什么值得听。",
      outroStyle: body.outroStyle?.trim() || "结尾收成一个 takeaway 和行动建议。",
      defaultIntro: body.defaultIntro?.trim() || undefined,
      defaultOutro: body.defaultOutro?.trim() || undefined,
      defaultDescription: body.defaultDescription?.trim() || undefined,
      backgroundMusicUrl: body.backgroundMusicUrl?.trim() || undefined,
      backgroundMusicLevel: body.backgroundMusicLevel || "subtle",
      introStingUrl: body.introStingUrl?.trim() || undefined,
      outroStingUrl: body.outroStingUrl?.trim() || undefined,
      template: body.template?.trim() || "insight-chat",
      personaMode: body.personaMode || "reality-mode",
      conflictLevel: body.conflictLevel || "medium",
      hostAId: body.hostAId?.trim() || "host-lin",
      hostBId: body.hostBId?.trim() || "host-jay",
    },
    user?.id,
  );

  return NextResponse.json({ show });
}
