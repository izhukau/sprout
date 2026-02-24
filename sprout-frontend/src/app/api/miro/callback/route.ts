import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  if (!code) {
    return NextResponse.json({ error: "No code in callback" }, { status: 400 });
  }

  const res = await fetch("https://api.miro.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.MIRO_CLIENT_ID ?? "",
      client_secret: process.env.MIRO_CLIENT_SECRET ?? "",
      code,
      redirect_uri: `${base}/api/miro/callback`,
    }),
  });

  const data = (await res.json()) as { access_token?: string; error?: string };

  if (!data.access_token) {
    return NextResponse.json(
      { error: data.error ?? "Token exchange failed" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set("miro_token", data.access_token, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
  });

  return NextResponse.redirect(new URL("/learn", request.url));
}
