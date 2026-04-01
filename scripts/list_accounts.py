#!/usr/bin/env python3
"""List all accounts created in the nextjs-login app."""

import argparse
import json
import urllib.request
import urllib.error


def main():
    parser = argparse.ArgumentParser(description="List all accounts in the nextjs-login app.")
    parser.add_argument(
        "-u", "--url", default="http://localhost:3000",
        help="Base URL of the app (default: http://localhost:3000)",
    )
    args = parser.parse_args()

    url = f"{args.url}/api/auth/users"
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
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
        return
    except Exception as e:
        print(f"Error: {e}")
        return

    users = data.get("users", [])
    total = data.get("count", len(users))

    print(f"Total accounts: {total}\n")
    print(f"{'ID':<40} {'Email':<40} {'Created'}")
    print(f"{'-'*40} {'-'*40} {'-'*25}")
    for u in users:
        print(f"{u['id']:<40} {u['email']:<40} {u['createdAt']}")


if __name__ == "__main__":
    main()
