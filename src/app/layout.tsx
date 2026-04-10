import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auth Demo",
  description: "Next.js authentication demo with JWT",
};

function isTrustedPerimeterScriptUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return h === "perimeterx.net" || h.endsWith(".perimeterx.net");
  } catch {
    return false;
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const raw = process.env.NEXT_PUBLIC_PERIMETERX_SCRIPT_URL;
  const perimeterScript =
    raw && isTrustedPerimeterScriptUrl(raw) ? raw : undefined;
  if (raw && !perimeterScript) {
    console.warn(
      "[layout] NEXT_PUBLIC_PERIMETERX_SCRIPT_URL is set but not an https:// URL on a *.perimeterx.net host; script not loaded."
    );
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {perimeterScript ? (
          <Script src={perimeterScript} strategy="beforeInteractive" />
        ) : null}
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
