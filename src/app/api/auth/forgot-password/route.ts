import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validations";
import { findUserByEmail, createResetToken } from "@/lib/store";
import { getClientKey, rateLimit } from "@/lib/rate-limit";
import { logRouteError } from "@/lib/log";

const ROUTE = "POST /api/auth/forgot-password";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 10;

export async function POST(request: Request) {
  const limited = rateLimit(`forgot:${getClientKey(request)}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  try {
    const body = await request.json();
    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = result.data;
    const user = findUserByEmail(email);

    if (!user) {
      return NextResponse.json({
        message: "If an account exists with that email, a reset link has been sent.",
      });
    }

    const resetToken = createResetToken(user.id);

    const payload: {
      message: string;
      devResetUrl?: string;
    } = {
      message: "If an account exists with that email, a reset link has been sent.",
    };

    if (
      process.env.NODE_ENV === "development" &&
      process.env.DEV_RETURN_RESET_TOKEN === "1"
    ) {
      const origin = new URL(request.url).origin;
      payload.devResetUrl = `${origin}/reset-password?token=${encodeURIComponent(resetToken)}`;
    }

    return NextResponse.json(payload);
  } catch (err) {
    logRouteError(ROUTE, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
