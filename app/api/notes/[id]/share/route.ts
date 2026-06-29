import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { randomBytes } from "crypto";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const note = await prisma.note.findUnique({ where: { id } });

  if (!note || note.userId !== user.id) {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }

  const { shareType, accessType, expiresAt: expiryInput } = await req.json();
  if (!["ONE_TIME", "TIME_BASED"].includes(shareType)) {
    return Response.json({ error: "Invalid shareType" }, { status: 400 });
  }
  if (!["PUBLIC", "PASSWORD_PROTECTED"].includes(accessType)) {
    return Response.json({ error: "Invalid accessType" }, { status: 400 });
  }
  let expiresAt: Date | null = null;
  if (shareType === "TIME_BASED") {
    if (!expiryInput) {
      return Response.json(
        { error: "expiresAt required for time-based links" },
        { status: 400 },
      );
    }
    expiresAt = new Date(expiryInput);
    if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return Response.json(
        { error: "expiresAt must be a valid future date" },
        { status: 400 },
      );
    }
  }

  const token = randomBytes(32).toString("base64url");

  let accessKey: string | null = null;
  let passwordHash: string | null = null;
  if (accessType === "PASSWORD_PROTECTED") {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const key = `${token}:${ip}`;
    if (!checkRateLimit(key)) {
      return Response.json(
        { error: "Too many attempts. Try later." },
        { status: 429 },
      );
    }
    accessKey = randomBytes(6).toString("hex");
    passwordHash = await hashPassword(accessKey);
  }

  await prisma.shareLink.create({
    data: {
      noteId: note.id,
      token,
      shareType,
      accessType,
      passwordHash,
      expiresAt,
    },
  });

  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  const url = `${base}/share/${token}`;
  return Response.json({ url, accessKey }, { status: 201 });
}
