import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/validations";
import { findUserByEmail } from "@/lib/store";
import { signToken, createTokenCookie } from "@/lib/auth";
import { getClientKey, rateLimit } from "@/lib/rate-limit";
import { logRouteError } from "@/lib/log";

const ROUTE = "POST /api/auth/login";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 20;

export async function POST(request: Request) {
  const limited = rateLimit(`login:${getClientKey(request)}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = result.data;
    const user = findUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = await signToken(user.id, user.email);

    const response = NextResponse.json(
      { message: "Logged in successfully", user: { id: user.id, email: user.email } },
      { status: 200 }
    );
    response.cookies.set(createTokenCookie(token));
    return response;
  } catch (err) {
    logRouteError(ROUTE, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
