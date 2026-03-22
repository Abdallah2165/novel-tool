import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { NewProjectCreator } from "@/components/projects/new-project-creator";
import { resolveHeadersUser } from "@/lib/auth/identity";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; session?: string }>;
}) {
  const user = await resolveHeadersUser(await headers()).catch(() => null);

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const initialMode = resolvedSearchParams.mode === "guided" ? "guided" : "blank";
  const initialSessionId = resolvedSearchParams.session?.trim() || null;

  return <NewProjectCreator initialMode={initialMode} initialSessionId={initialSessionId} />;
}
