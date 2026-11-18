import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyPassword, signToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { name, password } = await req.json().catch(() => ({}) as { name?: unknown; password?: unknown });
  if (typeof name !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  const { rows } = await pool.query("select id, name, password_hash from users where name = $1", [name.trim()]);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Nombre o contraseña incorrectos" }, { status: 401 });
  }
  const res = NextResponse.json({ id: user.id, name: user.name });
  res.cookies.set(SESSION_COOKIE, signToken({ sub: user.id, name: user.name }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
