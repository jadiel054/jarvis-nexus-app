import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type AuthResult =
  | { authorized: true; user: User | null; isInternal: boolean; response?: undefined }
  | { authorized: false; user?: null; isInternal?: false; response: NextResponse };

function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const reqSecret = req.headers.get("x-internal-secret");

  if (internalSecret && safeCompare(reqSecret, internalSecret)) {
    return { authorized: true, user: null, isInternal: true };
  }

  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      return { authorized: true, user, isInternal: false };
    }
  } catch {}

  return {
    authorized: false,
    response: NextResponse.json({ error: "Não autorizado" }, { status: 401 }),
  };
}
