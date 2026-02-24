import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COLORS = [
  "yellow",
  "light_green",
  "cyan",
  "light_pink",
  "light_yellow",
  "orange",
] as const;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("miro_token")?.value ?? process.env.MIRO_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const { topicTitle, keyPoints } = (await request.json()) as {
    topicTitle: string;
    keyPoints: string[];
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // 1. Create board
  const boardRes = await fetch("https://api.miro.com/v2/boards", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `Sprout — ${topicTitle}`,
      description: "Auto-generated topic summary by Sprout AI tutor",
    }),
  });

  if (!boardRes.ok) {
    const err = await boardRes.text();
    return NextResponse.json({ error: err }, { status: boardRes.status });
  }

  const board = (await boardRes.json()) as { id: string; viewLink: string };
  const boardId = board.id;

  // 2. Title sticky (centred, large)
  await fetch(`https://api.miro.com/v2/boards/${boardId}/sticky_notes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: { content: `<strong>${topicTitle}</strong>`, shape: "rectangle" },
      style: { fillColor: "yellow", textAlign: "center" },
      position: { x: 0, y: -380, origin: "center" },
      geometry: { width: 520 },
    }),
  });

  // 3. Key-point stickies arranged in a grid (3 columns)
  const cols = 3;
  const spacingX = 280;
  const spacingY = 260;
  const offsetX = -((cols - 1) * spacingX) / 2;

  for (let i = 0; i < keyPoints.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    await fetch(`https://api.miro.com/v2/boards/${boardId}/sticky_notes`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: { content: keyPoints[i], shape: "square" },
        style: { fillColor: COLORS[i % COLORS.length] },
        position: {
          x: offsetX + col * spacingX,
          y: row * spacingY,
          origin: "center",
        },
        geometry: { width: 240 },
      }),
    });
  }

  // 4. Return embed URL — use the viewLink for embedding
  const embedUrl = `https://miro.com/app/live-embed/${boardId}/`;
  return NextResponse.json({ boardId, embedUrl, viewLink: board.viewLink });
}
