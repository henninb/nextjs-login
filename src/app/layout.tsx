import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auth Demo",
  description: "Next.js authentication demo with JWT",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perimeterScript = process.env.NEXT_PUBLIC_PERIMETERX_SCRIPT_URL;

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
