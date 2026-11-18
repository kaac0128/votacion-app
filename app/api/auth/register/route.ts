import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword, signToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { name, password } = await req.json().catch(() => ({}) as { name?: unknown; password?: unknown });
  if (
    typeof name !== "string" || typeof password !== "string" ||
    name.trim().length < 2 || name.trim().length > 20 ||
    password.length < 4 || password.length > 72
  ) {
    return NextResponse.json({ error: "Nombre de 2 a 20 caracteres y contraseña de 4 a 72" }, { status: 400 });
  }
  const clean = name.trim();
  try {
    const { rows } = await pool.query(
      "insert into users (name, password_hash) values ($1, $2) returning id, name",
      [clean, hashPassword(password)]
    );
    const user = rows[0];
    const res = NextResponse.json({ id: user.id, name: user.name });
    res.cookies.set(SESSION_COOKIE, signToken({ sub: user.id, name: user.name }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return res;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "23505") return NextResponse.json({ error: "Ese nombre ya está tomado" }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "No se pudo crear la cuenta" }, { status: 500 });
  }
}
