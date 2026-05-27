export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[hsl(var(--foreground))]">403</h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          You do not have access to this organisation.
        </p>
      </div>
    </div>
  );
}
