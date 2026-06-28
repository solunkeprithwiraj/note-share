import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await params;
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: { note: true },
  });
  if (!link || link.note.userId !== user.id) {
    return Response.json({ error: "Invalid link" }, { status: 404 });
  }

  await prisma.shareLink.update({
    where: { token },
    data: { isRevoked: true },
  });

  return Response.json({ success: true }, { status: 200 });
}
