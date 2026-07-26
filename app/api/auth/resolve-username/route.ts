import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ email: null }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as
    | { username?: string }
    | null;
  const username = body?.username?.trim().toLowerCase();
  if (!username || username.length < 3 || username.length > 64) {
    return NextResponse.json({ email: null }, { status: 400 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase
    .from("finance_profiles")
    .select("login_email")
    .eq("username", username)
    .eq("status", "active")
    .maybeSingle();

  return NextResponse.json(
    { email: data?.login_email ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
