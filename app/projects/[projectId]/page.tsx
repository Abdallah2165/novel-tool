import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { WorkbenchShell } from "@/components/workspace/workbench-shell";
import { isWorkbenchMode } from "@/components/workspace/workbench-modes";
import { getWorkbenchSnapshot } from "@/lib/scaffold-data";
import { resolveHeadersUser } from "@/lib/auth/identity";

export const dynamic = "force-dynamic";

export default async function ProjectWorkbenchPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const user = await resolveHeadersUser(await headers()).catch(() => null);

  if (!user) {
    redirect("/login");
  }

  const { projectId } = await params;
  const rawMode = (await searchParams).mode;
  const requestedMode = Array.isArray(rawMode) ? rawMode[0] : rawMode;
  const mode = isWorkbenchMode(requestedMode) ? requestedMode : "task";
  const project = await getWorkbenchSnapshot(projectId, user.id);

  if (!project) {
    notFound();
  }

  return <WorkbenchShell project={project} mode={mode} />;
}
