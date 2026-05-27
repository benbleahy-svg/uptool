export const RESERVED_SLUGS = new Set([
  "api",
  "signin",
  "signup",
  "onboarding",
  "legal",
  "health",
  "_next",
  "static",
  "images",
  "public",
  "admin",
  "docs",
  "help",
  "support",
  "pricing",
  "about",
  "terms",
  "privacy",
]);

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
