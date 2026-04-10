import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";

const COOKIE_NAME = "token";

const jwtPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
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

const JWT_SECRET = getJwtSecret();

export interface JWTPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export async function signToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const parsed = jwtPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return null;
    }
    const { sub, email, iat, exp } = parsed.data;
    return {
      sub,
      email,
      iat: iat ?? 0,
      exp,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
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
