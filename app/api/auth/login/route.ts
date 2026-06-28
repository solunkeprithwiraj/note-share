import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password || password.length < 8) {
    return Response.json({ error: "Invalid Credentials" }, { status: 400 });
  }

 const user = await prisma.user.findUnique({ where: { email } });
 if (!user || !(await verifyPassword(password, user.password))) {
   return Response.json({ error: "Invalid credentials" }, { status: 401 });
 }

  const token = signToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return Response.json({ id: user.id, email: user.email }, { status: 200 });
}
