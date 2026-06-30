import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function encryptSettingValue(value: string): string {
  if (!value) return "";
  return `enc:${Buffer.from(value, "utf8").toString("base64")}`;
}

function decryptSettingValue(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith("enc:")) return value;

  try {
    return Buffer.from(value.slice(4), "base64").toString("utf8");
  } catch {
    return value;
  }
}

async function getAuthenticatedUser() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: "Não autenticado" };
  }

  return { user, error: null };
}

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const { user, error } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const { data, error: settingsError } = await supabase
    .from("settings")
    .select("key, value")
    .eq("user_id", user.id);

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }

  const settings = Object.fromEntries(
    (data || []).map((row) => [row.key, decryptSettingValue(row.value)])
  );

  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const rawSettings = payload?.settings;

  if (!rawSettings || typeof rawSettings !== "object" || Array.isArray(rawSettings)) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const entries = Object.entries(rawSettings as Record<string, unknown>).filter(
    ([key, value]) => typeof key === "string" && typeof value === "string"
  ) as [string, string][];

  const filledEntries = entries.filter(([, value]) => value.trim() !== "");
  const emptyKeys = entries.filter(([, value]) => value.trim() === "").map(([key]) => key);
  const admin = getAdminClient();

  if (filledEntries.length > 0) {
    const { error: upsertError } = await admin.from("settings").upsert(
      filledEntries.map(([key, value]) => ({
        user_id: user.id,
        key,
        value: encryptSettingValue(value),
      })),
      { onConflict: "user_id,key" }
    );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  if (emptyKeys.length > 0) {
    const { error: deleteError } = await admin
      .from("settings")
      .delete()
      .eq("user_id", user.id)
      .in("key", emptyKeys);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    saved: filledEntries.length,
    removed: emptyKeys.length,
  });
}
