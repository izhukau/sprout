import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  // Also accept a static token from env (for dev convenience)
  const token =
    cookieStore.get("miro_token")?.value ?? process.env.MIRO_ACCESS_TOKEN;
  return NextResponse.json({ connected: Boolean(token) });
}
