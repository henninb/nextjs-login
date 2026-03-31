import { NextResponse } from "next/server";
import { deleteTokenCookie } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json(
    { message: "Logged out successfully" },
    { status: 200 }
  );
  response.cookies.set(deleteTokenCookie());
  return response;
}
