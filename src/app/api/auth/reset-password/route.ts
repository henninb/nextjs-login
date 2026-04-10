import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { resetPasswordSchema } from "@/lib/validations";
import { consumeResetToken, updateUserPassword } from "@/lib/store";
import { getClientKey, rateLimit } from "@/lib/rate-limit";
import { logRouteError } from "@/lib/log";

const ROUTE = "POST /api/auth/reset-password";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 15;

export async function POST(request: Request) {
  const limited = rateLimit(`reset:${getClientKey(request)}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  try {
    const body = await request.json();
    const result = resetPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { token, password } = result.data;
    const userId = consumeResetToken(token);

    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    updateUserPassword(userId, passwordHash);

    return NextResponse.json({
      message: "Password has been reset successfully",
    });
  } catch (err) {
    logRouteError(ROUTE, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
