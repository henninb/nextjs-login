#!/usr/bin/env python3
"""Bulk account creation via Playwright (real browser) to bypass PerimeterX."""

import argparse
import asyncio
import random
import string
import time
from dataclasses import dataclass
from playwright.async_api import async_playwright, Page, Browser


@dataclass
class Result:
    email: str
    success: bool
    detail: str
    elapsed_ms: float


DEFAULT_PASSWORD = "TestPass1"
REGISTER_PATH = "/register"
MAX_RETRIES = 3


async def human_type(page: Page, selector: str, text: str):
    """Type text character-by-character with random delays to mimic a human."""
    await page.click(selector)
    for char in text:
        await page.keyboard.type(char, delay=random.randint(30, 90))
    await asyncio.sleep(random.uniform(0.1, 0.3))


async def try_create_account(browser, base_url: str, email: str, password: str) -> Result:
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
    page = await context.new_page()
    start = time.perf_counter()
    try:
        await page.goto(f"{base_url}{REGISTER_PATH}", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_selector("#email", state="visible", timeout=30000)
        await asyncio.sleep(random.uniform(0.5, 1.5))

        await human_type(page, "#email", email)
        await human_type(page, "#password", password)
        await human_type(page, "#confirmPassword", password)

        await asyncio.sleep(random.uniform(0.3, 0.8))

        async with page.expect_response(
            lambda r: "/api/auth/register" in r.url, timeout=30000
        ) as resp_info:
            await page.click('button[type="submit"]')

        resp = await resp_info.value
        status = resp.status
        body = await resp.json()

        elapsed = (time.perf_counter() - start) * 1000
        if status == 201:
            return Result(email=email, success=True, detail=body.get("message", "ok"), elapsed_ms=round(elapsed, 1))
        else:
            return Result(email=email, success=False, detail=body.get("error", str(body)), elapsed_ms=round(elapsed, 1))

    except Exception as e:
        elapsed = (time.perf_counter() - start) * 1000
        return Result(email=email, success=False, detail=str(e), elapsed_ms=round(elapsed, 1))
    finally:
        await page.close()
        await context.close()


async def create_account_with_retry(browser, base_url: str, email: str, password: str) -> Result:
    for attempt in range(1, MAX_RETRIES + 1):
        result = await try_create_account(browser, base_url, email, password)
        if result.success:
            return result
        if attempt < MAX_RETRIES:
            backoff = random.uniform(2, 5) * attempt
            print(f"    ↻ {email} retry {attempt}/{MAX_RETRIES} after {backoff:.0f}s...")
            await asyncio.sleep(backoff)
    return result


async def run(base_url: str, count: int, prefix: str, domain: str, password: str, concurrency: int, delay: float, headed: bool):
    def rand_suffix():
        return "".join(random.choices(string.ascii_lowercase + string.digits, k=6))

    emails = [f"{prefix}{i}_{rand_suffix()}@{domain}" for i in range(1, count + 1)]
    results: list[Result] = []
    sem = asyncio.Semaphore(concurrency)

    async def worker(email: str, idx: int):
        async with sem:
            result = await create_account_with_retry(browser, base_url, email, password)
            results.append(result)
            tag = "OK" if result.success else "FAIL"
            print(f"  [{idx}/{count}] {tag} {result.email} — {result.detail}")

    async with async_playwright() as p:
        launch_args = []
        if headed:
            launch_args += ["--window-position=-9999,-9999", "--window-size=800,600"]
        browser = await p.chromium.launch(
            headless=not headed, channel="chrome", args=launch_args,
        )

        tasks: list[asyncio.Task] = []
        for i, email in enumerate(emails):
            tasks.append(asyncio.create_task(worker(email, i + 1)))
            if delay > 0 and i < len(emails) - 1:
                await asyncio.sleep(delay + random.uniform(0, delay * 0.5))

        await asyncio.gather(*tasks)
        await browser.close()

    succeeded = [r for r in results if r.success]
    failed = [r for r in results if not r.success]

    print(f"\n{'='*60}")
    print(f"Results: {len(succeeded)} created, {len(failed)} failed out of {count}")
    if results:
        avg = sum(r.elapsed_ms for r in results) / len(results)
        print(f"Avg time per account: {avg:.0f}ms")
    print(f"{'='*60}\n")

    if failed:
        print("Failures:")
        for r in failed:
            print(f"  {r.email} — {r.detail}")
        print()


def main():
    parser = argparse.ArgumentParser(
        description="Create test accounts in bulk using a real browser (Playwright)."
    )
    parser.add_argument(
        "-n", "--count", type=int, default=10,
        help="Number of accounts to create (default: 10)",
    )
    parser.add_argument(
        "-u", "--url", default="https://www.bhenning.com",
        help="Base URL of the app (default: https://www.bhenning.com)",
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
        "-c", "--concurrency", type=int, default=2,
        help="Max concurrent browser tabs (default: 2)",
    )
    parser.add_argument(
        "-d", "--delay", type=float, default=2.0,
        help="Seconds between launching each account (default: 2.0)",
    )
    parser.add_argument(
        "--headed", action="store_true",
        help="Show the browser window (default: headless)",
    )
    args = parser.parse_args()

    print(f"Creating {args.count} accounts on {args.url}")
    print(f"Email pattern: {args.prefix}<N>@{args.domain}")
    print(f"Concurrency: {args.concurrency} tabs, ~{args.delay}s stagger")
    print(f"Mode: {'headed' if args.headed else 'headless'}\n")

    asyncio.run(run(args.url, args.count, args.prefix, args.domain, args.password, args.concurrency, args.delay, args.headed))


if __name__ == "__main__":
    main()
