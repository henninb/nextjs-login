import { NextResponse } from "next/server";
import { getAllUsers } from "@/lib/store";

export async function GET() {
  const users = getAllUsers().map(({ id, email, createdAt }) => ({
    id,
    email,
    createdAt,
  }));

  return NextResponse.json({ count: users.length, users });
}
