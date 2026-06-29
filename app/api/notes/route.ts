import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notes = await prisma.note.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      _count: { select: { shareLinks: true } },
    },
  });
  return Response.json(notes, { status: 200 });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, content } = await req.json();
  if (!title || !content) {
    return Response.json(
      { error: "Title and content required" },
      { status: 400 },
    );
  }

  const note = await prisma.note.create({
    data: { title, content, userId: user.id },
  });
  return Response.json({ id: note.id, title: note.title }, { status: 201 });
}
