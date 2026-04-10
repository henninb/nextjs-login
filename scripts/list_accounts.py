#!/usr/bin/env python3
"""List all accounts created in the nextjs-login app.

Requires ADMIN_LIST_USERS_SECRET in the environment (or --token) matching the
server's ADMIN_LIST_USERS_SECRET. If the server has no secret configured, this
endpoint returns 404.
"""

import argparse
import json
import os
import urllib.request
import urllib.error


def main():
    parser = argparse.ArgumentParser(description="List all accounts in the nextjs-login app.")
    parser.add_argument(
        "-u", "--url", default="http://localhost:3000",
        help="Base URL of the app (default: http://localhost:3000)",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("ADMIN_LIST_USERS_SECRET"),
        help="Bearer token (defaults to ADMIN_LIST_USERS_SECRET env var)",
    )
    args = parser.parse_args()

    if not args.token:
        print(
            "Error: set ADMIN_LIST_USERS_SECRET in the environment or pass --token "
            "(must match the Next.js server's ADMIN_LIST_USERS_SECRET).",
            file=__import__("sys").stderr,
        )
        return 1

    url = f"{args.url}/api/auth/users"
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "Authorization": f"Bearer {args.token}",
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
    })

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"Error: HTTP {e.code} — {body}")
        return 1
    except Exception as e:
        print(f"Error: {e}")
        return 1

    users = data.get("users", [])
    total = data.get("count", len(users))

    print(f"Total accounts: {total}\n")
    print(f"{'ID':<40} {'Email':<40} {'Created'}")
    print(f"{'-'*40} {'-'*40} {'-'*25}")
    for u in users:
        print(f"{u['id']:<40} {u['email']:<40} {u['createdAt']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
