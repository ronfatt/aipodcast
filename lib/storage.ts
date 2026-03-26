import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase";

const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "episode-assets";

async function ensureBucket() {
  const supabase = getSupabaseAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw listError;
  }

  const exists = buckets.some((bucket) => bucket.name === bucketName);

  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 1024 * 1024 * 50,
    });

    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      throw createError;
    }
  }
}

export function isSupabaseStorageEnabled() {
  return hasSupabaseConfig();
}

export async function uploadFileToStorage(
  localFilePath: string,
  objectPath: string,
  contentType: string,
) {
  if (!isSupabaseStorageEnabled()) {
    throw new Error("Supabase storage is not configured.");
  }

  await ensureBucket();
  const supabase = getSupabaseAdminClient();
  const file = await readFile(localFilePath);
  const { error } = await supabase.storage.from(bucketName).upload(objectPath, file, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(objectPath);

  return {
    publicUrl: data.publicUrl,
    objectPath,
    bucketName,
  };
}

export async function uploadBufferToStorage(
  file: Buffer | Uint8Array | ArrayBuffer,
  objectPath: string,
  contentType: string,
) {
  if (!isSupabaseStorageEnabled()) {
    throw new Error("Supabase storage is not configured.");
  }

  await ensureBucket();
  const supabase = getSupabaseAdminClient();
  const payload = file instanceof ArrayBuffer ? Buffer.from(file) : Buffer.from(file);
  const { error } = await supabase.storage.from(bucketName).upload(objectPath, payload, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(objectPath);

  return {
    publicUrl: data.publicUrl,
    objectPath,
    bucketName,
  };
}

export async function deleteStorageObjectFromUrl(url?: string) {
  if (!url || !isSupabaseStorageEnabled()) {
    return;
  }

  const marker = `/storage/v1/object/public/${bucketName}/`;
  const markerIndex = url.indexOf(marker);

  if (markerIndex === -1) {
    return;
  }

  const objectPath = url.slice(markerIndex + marker.length).split("?")[0];
  const supabase = getSupabaseAdminClient();
  await supabase.storage.from(bucketName).remove([objectPath]);
}

export async function ensureLocalDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}
