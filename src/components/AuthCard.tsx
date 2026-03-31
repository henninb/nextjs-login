import Link from "next/link";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            &larr; Home
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          {children}
        </div>

        {footer && (
          <div className="mt-4 text-center text-sm text-gray-500">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
