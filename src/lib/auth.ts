import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";
import { findUserById } from "@/lib/store";

const COOKIE_NAME = "token";

const jwtPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  sv: z.number().int(),
  iat: z.number().optional(),
  exp: z.number(),
});

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length > 0) {
    return new TextEncoder().encode(secret);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to a strong value in production");
  }
  console.warn(
    "[auth] JWT_SECRET is not set; using a development-only placeholder. Set JWT_SECRET before production."
  );
  return new TextEncoder().encode("dev-only-placeholder-not-for-production");
}

export interface JWTPayload {
  sub: string;
  email: string;
  sv: number;
  iat: number;
  exp: number;
}

export async function signToken(
  userId: string,
  email: string,
  sessionVersion: number
): Promise<string> {
  return new SignJWT({ sub: userId, email, sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const parsed = jwtPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return null;
    }
    const { sub, email, sv, iat, exp } = parsed.data;
    return {
      sub,
      email,
      sv,
      iat: iat ?? 0,
      exp,
    };
  } catch {
    return null;
  }
}

/** Cryptographic JWT verification plus session version match (invalidates tokens after password change). */
export async function validateSessionToken(token: string): Promise<JWTPayload | null> {
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = findUserById(payload.sub);
  if (!user || user.sessionVersion !== payload.sv) return null;
  return payload;
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return validateSessionToken(token);
}

export function createTokenCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}

export function deleteTokenCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
