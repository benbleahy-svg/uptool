import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { memberService } from "@uptool/services";
import { addMember, removeMember } from "./actions";
import { RoleSelect } from "./role-select";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function MembersPage({ params }: Props) {
  const { orgSlug } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) notFound();

  const members = await memberService.findByOrg(org.id);
  const t = await getTranslations("settings.members");

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold mb-1">{t("title")}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("subtitle")}</p>
      </div>

      {/* Members list */}
      <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--muted)/0.4)] border-b border-[hsl(var(--border))]">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                {t("col_name")}
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                {t("col_email")}
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                {t("col_role")}
              </th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {members.map((m) => (
              <tr key={m.userId}>
                <td className="px-4 py-2 font-medium">{m.user.name ?? "—"}</td>
                <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">{m.user.email}</td>
                <td className="px-4 py-2">
                  <RoleSelect
                    orgSlug={orgSlug}
                    userId={m.userId}
                    currentRole={m.role}
                    labels={{
                      owner: t("role_owner"),
                      estimator: t("role_estimator"),
                      office: t("role_office"),
                    }}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  {m.userId !== session?.user?.id && (
                    <form action={removeMember}>
                      <input type="hidden" name="orgSlug" value={orgSlug} />
                      <input type="hidden" name="userId" value={m.userId} />
                      <button
                        type="submit"
                        className="text-xs text-[hsl(var(--muted-foreground))] hover:text-red-600 transition-colors"
                      >
                        {t("remove")}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add member form */}
      <details className="group">
        <summary className="text-sm font-medium text-[hsl(var(--primary))] cursor-pointer list-none hover:underline">
          + {t("add_member")}
        </summary>
        <form action={addMember} className="mt-4 flex items-end gap-3">
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <div>
            <label htmlFor="new-member-email" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
              {t("col_email")}
            </label>
            <input
              id="new-member-email"
              name="email"
              type="email"
              required
              className="rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div>
            <label htmlFor="new-member-role" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
              {t("col_role")}
            </label>
            <select
              id="new-member-role"
              name="role"
              defaultValue="estimator"
              className="rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            >
              <option value="owner">{t("role_owner")}</option>
              <option value="estimator">{t("role_estimator")}</option>
              <option value="office">{t("role_office")}</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            {t("add")}
          </button>
        </form>
      </details>
    </div>
  );
}
