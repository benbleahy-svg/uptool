import { redirect } from "next/navigation";

// Dev-only auto-signin page. Not rendered in production.
export default function DevSignInPage() {
  if (process.env.NODE_ENV !== "development") {
    redirect("/signin");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm text-center space-y-4 w-80">
        <div className="w-8 h-8 rounded bg-blue-600 mx-auto" />
        <h1 className="text-lg font-semibold">Dev sign-in</h1>
        <p className="text-sm text-gray-500">
          Signs in as <code className="bg-gray-100 px-1 rounded">owner@acme.test</code> without email verification.
        </p>
        <a
          href="/api/dev-signin"
          className="block w-full rounded bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 text-center"
        >
          Enter app →
        </a>
      </div>
    </div>
  );
}
