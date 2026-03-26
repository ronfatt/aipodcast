import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getShowById, updateShow } from "@/lib/show-store";
import { CreateShowInput } from "@/lib/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (process.env.ENABLE_SUPABASE_AUTH === "true" && !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getShowById(id, user?.id);

  if (!existing) {
    return NextResponse.json({ error: "Show not found." }, { status: 404 });
  }

  const body = (await request.json()) as Partial<CreateShowInput>;
  const updated = await updateShow(
    id,
    {
      ...body,
    },
    user?.id,
  );

  return NextResponse.json({ show: updated });
}
