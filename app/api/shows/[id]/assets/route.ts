import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { uploadBufferToStorage } from "@/lib/storage";
import { getShowById, updateShow } from "@/lib/show-store";

const assetFieldMap = {
  cover: "coverImageUrl",
  background: "backgroundMusicUrl",
  intro_sting: "introStingUrl",
  outro_sting: "outroStingUrl",
} as const;

type AssetType = keyof typeof assetFieldMap;

function isAssetType(value: string): value is AssetType {
  return value in assetFieldMap;
}

function sanitizeFileSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (process.env.ENABLE_SUPABASE_AUTH === "true" && !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const show = await getShowById(id, user?.id);

  if (!show) {
    return NextResponse.json({ error: "Show not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const assetTypeValue = formData.get("assetType");
  const file = formData.get("file");

  if (typeof assetTypeValue !== "string" || !isAssetType(assetTypeValue)) {
    return NextResponse.json({ error: "Unsupported asset type." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please attach a file." }, { status: 400 });
  }

  const extension = path.extname(file.name || "") || (file.type === "image/png" ? ".png" : ".wav");
  const objectPath = `show-assets/${sanitizeFileSegment(show.name)}/${assetTypeValue}${extension}`;
  const uploaded = await uploadBufferToStorage(await file.arrayBuffer(), objectPath, file.type || "application/octet-stream");
  const fieldName = assetFieldMap[assetTypeValue];
  const updated = await updateShow(
    id,
    {
      [fieldName]: uploaded.publicUrl,
    },
    user?.id,
  );

  return NextResponse.json({
    show: updated,
    assetType: assetTypeValue,
    assetUrl: uploaded.publicUrl,
  });
}
