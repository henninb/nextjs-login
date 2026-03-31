import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validations";
import { findUserByEmail, createResetToken } from "@/lib/store";

export async function POST(request: Request) {
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

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: "If an account exists with that email, a reset link has been sent.",
      });
    }

    const token = createResetToken(user.id);

    // In a real app, you'd send an email here. For demo, log to console.
    console.log("\n========================================");
    console.log("  PASSWORD RESET LINK (Demo)");
    console.log(`  Email: ${email}`);
    console.log(`  Link: http://localhost:3000/reset-password?token=${token}`);
    console.log("========================================\n");

    return NextResponse.json({
      message: "If an account exists with that email, a reset link has been sent.",
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
