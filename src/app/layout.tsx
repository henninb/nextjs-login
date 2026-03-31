import type { Metadata } from "next";
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
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
