import { NextResponse } from "next/server";
import { getAllUsers } from "@/lib/store";

/**
 * Listing users requires ADMIN_LIST_USERS_SECRET. If unset, the route returns 404
 * so the endpoint is not discoverable in default deployments.
 */
export async function GET(request: Request) {
  const secret = process.env.ADMIN_LIST_USERS_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = getAllUsers().map(({ id, email, createdAt }) => ({
    id,
    email,
    createdAt,
  }));

  return NextResponse.json({ count: users.length, users });
}
