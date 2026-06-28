import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req: Request) {
      const { email, password } = await req.json();

  if (!email || !password || password.length < 8) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json(
      { error: "Email already registered" },
      { status: 409 },
    );
  }

  const hash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { email, password: hash },
  });

  const token = signToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, 
    path: "/",
  });

  return Response.json({ id: user.id, email: user.email }, { status: 201 });
}
