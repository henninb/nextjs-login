import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { registerSchema } from "@/lib/validations";
import { findUserByEmail, createUser } from "@/lib/store";
import { getClientKey, rateLimit } from "@/lib/rate-limit";
import { logRouteError } from "@/lib/log";

const ROUTE = "POST /api/auth/register";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 10;

export async function POST(request: Request) {
  const limited = rateLimit(`register:${getClientKey(request)}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    if (findUserByEmail(email)) {
      return NextResponse.json({ message: "Registration successful" }, { status: 201 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    createUser(email, passwordHash);

    /* No session cookie: same response shape as duplicate email to prevent account enumeration. */
    return NextResponse.json({ message: "Registration successful" }, { status: 201 });
  } catch (err) {
    logRouteError(ROUTE, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
