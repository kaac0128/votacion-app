import crypto from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";

const AUTH_SECRET = process.env.AUTH_SECRET ?? "";
if (!AUTH_SECRET) throw new Error("AUTH_SECRET is not set");

// scrypt: salt:hash — sin dependencias externas
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const real = Buffer.from(hash, "hex");
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

// JWT HS256 mínimo con node:crypto
export function signToken(payload: { sub: string; name: string }): string {
  const ttl = 60 * 60 * 24 * 30;
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttl })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): { sub: string; name: string } | null {
  const [header, body, sig] = token.split(".");
  if (!header || !body || !sig) return null;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(`${header}.${body}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    if (typeof payload.sub !== "string" || typeof payload.name !== "string") return null;
    return { sub: payload.sub, name: payload.name };
  } catch {
    return null;
  }
}

// Sesión actual desde la cookie httpOnly
export async function getUser(): Promise<{ id: string; name: string } | null> {
  // marca la rama como dinámica: sin esto, el prerender valida Date.now() y falla
  await connection();
  const token = (await cookies()).get("session")?.value;
  if (!token) return null;
  const session = verifyToken(token);
  return session ? { id: session.sub, name: session.name } : null;
}

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
