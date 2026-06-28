import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link) {
    return Response.json({ error: "Invalid link" }, { status: 404 });
  }

  const expired =
    link.shareType === "TIME_BASED" &&
    !!link.expiresAt &&
    link.expiresAt <= new Date();
  const used = link.shareType === "ONE_TIME" && !!link.usedAt;

  const status = link.isRevoked
    ? "revoked"
    : expired
      ? "expired"
      : used
        ? "used"
        : "active";

  return Response.json(
    { accessType: link.accessType, shareType: link.shareType, status },
    { status: 200 },
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link) {
    return Response.json({ error: "Invalid link" }, { status: 404 });
  }

  if (link.isRevoked) {
    return Response.json({ error: "Link revoked" }, { status: 410 });
  }

  if (
    link.shareType === "TIME_BASED" &&
    link.expiresAt &&
    link.expiresAt <= new Date()
  ) {
    return Response.json({ error: "Link expired" }, { status: 410 });
  }

  if (link.shareType === "ONE_TIME" && link.usedAt) {
    return Response.json({ error: "Link already used" }, { status: 410 });
  }

  if (link.accessType === "PASSWORD_PROTECTED") {
     const ip = req.headers.get("x-forwarded-for") ?? "unknown";
     const key = `${token}:${ip}`;
     if (!checkRateLimit(key)) {
       return Response.json(
         { error: "Too many attempts. Try later." },
         { status: 429 },
       );
     }
    const { password } = await req
      .json()
      .catch(() => ({ password: undefined }));
    if (
      !password ||
      !link.passwordHash ||
      !(await verifyPassword(password, link.passwordHash))
    ) {
      return Response.json({ error: "Invalid password" }, { status: 401 });
    }
  }

  if (link.shareType === "ONE_TIME") {
    const result = await prisma.shareLink.updateMany({
      where: { token, usedAt: null, isRevoked: false },
      data: { usedAt: new Date(), viewCount: { increment: 1 } },
    });
    if (result.count === 0) {
      return Response.json({ error: "Link already used" }, { status: 410 });
    }
  } else {
    await prisma.shareLink.update({
      where: { token },
      data: { viewCount: { increment: 1 } },
    });
  }

  const note = await prisma.note.findUnique({
    where: { id: link.noteId },
    select: { title: true, content: true },
  });
  return Response.json(
    { title: note?.title, content: note?.content },
    { status: 200 },
  );
}
