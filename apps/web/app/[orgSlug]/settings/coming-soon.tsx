import { Construction } from "lucide-react";

interface Props {
  title: string;
  pageTitle: string;
  subtitle: string;
}

export function ComingSoon({ title, pageTitle, subtitle }: Props) {
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">{pageTitle}</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Construction className="w-10 h-10 text-[hsl(var(--muted-foreground))] mb-4" />
        <p className="text-base font-medium text-[hsl(var(--foreground))]">{title}</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
