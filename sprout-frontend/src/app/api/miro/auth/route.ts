import { redirect } from "next/navigation";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.MIRO_CLIENT_ID ?? "",
    redirect_uri: `${base}/api/miro/callback`,
  });
  redirect(`https://miro.com/oauth/authorize?${params}`);
}
