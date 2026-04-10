#!/usr/bin/env python3
"""Bulk account creation via Playwright.

Opens one page, lets the PX sensor establish trust, then calls the register API
from within the page context. Applies stealth patches to avoid headless detection.

Setup (use a venv; macOS/Homebrew Python blocks global pip installs)

    cd scripts
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    playwright install chromium

    Google Chrome must be installed (the script launches Chromium via channel="chrome").

Usage

    .venv/bin/python create_accounts.py
    .venv/bin/python create_accounts.py -n 5 -u https://localhost:3000 --prefix qa --domain example.com
    .venv/bin/python create_accounts.py --headed -u https://www.example.com   # if PX blocks headless
    .venv/bin/python create_accounts.py -h
"""

import argparse
import asyncio
import random
import string
import time
from dataclasses import dataclass
from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError, async_playwright


@dataclass
class Result:
    email: str
    success: bool
    detail: str


DEFAULT_PASSWORD = "TestPass1"
SETTLE_SECONDS = 8
FORM_WAIT_SECONDS = 45

STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
});

Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
});

const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
    parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

window.chrome = { runtime: {} };
"""


async def is_px_or_block_page(page: Page) -> bool:
    """True when PerimeterX (or similar) served a block/captcha page instead of the app."""
    return await page.evaluate(
        """() => {
            const t = (document.title || '').toLowerCase();
            if (t.includes('access to this page has been denied')) return true;
            if (t.includes('just a moment') || t.includes('attention required')) return true;
            const meta = document.querySelector('meta[name="description"]');
            if (meta && (meta.getAttribute('content') || '').toLowerCase() === 'px-captcha')
                return true;
            if (document.querySelector('#px-captcha-modal')) return true;
            const body = document.body;
            if (body && body.innerText && body.innerText.includes('Press & Hold')) return true;
            return false;
        }"""
    )


async def wait_for_register_form(page: Page) -> None:
    """Wait until the email field is visible, or fail with a clear error if PX blocks."""
    deadline = time.monotonic() + FORM_WAIT_SECONDS
    email_sel = 'input[name="email"], input#email, [type="email"]'
    while time.monotonic() < deadline:
        if await is_px_or_block_page(page):
            raise RuntimeError(
                "PerimeterX (or a bot wall) blocked this page before the register form appeared. "
                "Headless automation often gets 403/captcha on production. "
                "Try: --headed, use http://localhost:3000 for local testing, or adjust PX for trusted IPs."
            )
        try:
            await page.wait_for_selector(email_sel, state="visible", timeout=500)
            return
        except PlaywrightTimeoutError:
            await asyncio.sleep(0.5)
    raise RuntimeError(
        f"Register form did not become visible within {FORM_WAIT_SECONDS}s "
        f"(selector: {email_sel!r}). Check the URL, network, and whether the app is up."
    )


async def register_via_fetch(page: Page, email: str, password: str) -> Result:
    """Call the register API from inside the browser page so PX cookies are sent."""
    resp = await page.evaluate(
        """async ([email, password]) => {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, confirmPassword: password }),
            });
            const text = await res.text();
            let body;
            try {
                body = JSON.parse(text);
            } catch {
                return { status: res.status, body: { error: `PX block (HTTP ${res.status})` } };
            }
            return { status: res.status, body };
        }""",
        [email, password],
    )
    status = resp["status"]
    body = resp["body"]
    if status == 201 and isinstance(body, dict) and not body.get("error"):
        return Result(email=email, success=True, detail=body.get("message", "ok"))
    err = body.get("error") if isinstance(body, dict) else None
    return Result(email=email, success=False, detail=err or str(body))


async def run(
    base_url: str,
    count: int,
    prefix: str,
    domain: str,
    password: str,
    delay: float,
    headed: bool,
):
    def rand_suffix():
        return "".join(random.choices(string.ascii_lowercase + string.digits, k=6))

    emails = [f"{prefix}{i}_{rand_suffix()}@{domain}" for i in range(1, count + 1)]
    results: list[Result] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=not headed,
            channel="chrome",
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process",
                "--no-first-run",
                "--no-default-browser-check",
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            locale="en-US",
            timezone_id="America/Chicago",
        )

        await context.add_init_script(STEALTH_JS)
        page = await context.new_page()

        print(f"Loading {base_url}/register and waiting {SETTLE_SECONDS}s for PX sensor...")
        await page.goto(f"{base_url}/register", wait_until="load", timeout=60000)
        await wait_for_register_form(page)
        await asyncio.sleep(SETTLE_SECONDS)

        # Verify PX isn't blocking the page
        has_captcha = await page.evaluate("!!document.querySelector('#px-captcha-modal')")
        if has_captcha:
            print("WARNING: PX captcha detected on page. Requests will likely be blocked.\n")
        else:
            print("PX sensor settled, no captcha. Starting account creation.\n")

        for i, email in enumerate(emails):
            start = time.perf_counter()
            result = await register_via_fetch(page, email, password)
            elapsed = (time.perf_counter() - start) * 1000
            results.append(result)

            tag = "OK" if result.success else "FAIL"
            print(f"  [{i+1}/{count}] {tag} {email} — {result.detail}  ({elapsed:.0f}ms)")

            # Clear only the app auth cookie, keep PX cookies intact
            await context.clear_cookies(name="token")

            if i < len(emails) - 1:
                await asyncio.sleep(delay + random.uniform(0, delay * 0.5))

        await page.close()
        await context.close()
        await browser.close()

    succeeded = [r for r in results if r.success]
    failed = [r for r in results if not r.success]

    print(f"\n{'='*60}")
    print(f"Results: {len(succeeded)} created, {len(failed)} failed out of {count}")
    print(f"{'='*60}\n")

    if failed:
        print("Failures:")
        for r in failed:
            print(f"  {r.email} — {r.detail}")
        print()


def main():
    parser = argparse.ArgumentParser(
        description="Create test accounts in bulk using a real browser (Playwright).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  %(prog)s
  %(prog)s -n 25 -u https://localhost:3000
  %(prog)s --prefix loadtest --domain mydomain.test --password 'MySecret1' -d 2.0
""",
    )
    parser.add_argument(
        "-n", "--count", type=int, default=10,
        help="Number of accounts to create (default: 10)",
    )
    parser.add_argument(
        "-u", "--url", default="http://localhost:3000",
        help="Base URL of the app (default: http://localhost:3000)",
    )
    parser.add_argument(
        "--prefix", default="testuser",
        help="Email prefix (default: testuser)",
    )
    parser.add_argument(
        "--domain", default="test.com",
        help="Email domain (default: test.com)",
    )
    parser.add_argument(
        "--password", default=DEFAULT_PASSWORD,
        help=f"Password for all accounts (default: {DEFAULT_PASSWORD})",
    )
    parser.add_argument(
        "-d", "--delay", type=float, default=1.0,
        help="Seconds between each account (default: 1.0)",
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Run Chrome visibly (not headless). Often needed when PerimeterX blocks headless clients.",
    )
    args = parser.parse_args()

    print(f"Creating {args.count} accounts on {args.url}")
    print(f"Email pattern: {args.prefix}<N>@{args.domain}")
    print(f"Delay: ~{args.delay}s between requests\n")

    asyncio.run(
        run(
            args.url,
            args.count,
            args.prefix,
            args.domain,
            args.password,
            args.delay,
            args.headed,
        )
    )


if __name__ == "__main__":
    main()
