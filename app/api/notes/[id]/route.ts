import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const note = await prisma.note.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      shareLinks: {
        select: {
          id: true,
          token: true,
          shareType: true,
          accessType: true,
          expiresAt: true,
          usedAt: true,
          isRevoked: true,
          viewCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!note || note.userId !== user.id) {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }

  return Response.json(note, { status: 200 });
}
