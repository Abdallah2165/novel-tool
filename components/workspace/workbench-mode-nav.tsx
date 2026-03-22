import { ButtonLink } from "@/components/ui/button-link";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";

import { WORKBENCH_MODE_META, type WorkbenchMode } from "./workbench-modes";

export function WorkbenchModeNav({
  projectId,
  projectName,
  activeMode,
}: {
  projectId: string;
  projectName: string;
  activeMode: WorkbenchMode;
}) {
  const activeModeMeta = WORKBENCH_MODE_META.find((item) => item.value === activeMode) ?? WORKBENCH_MODE_META[0];

  return (
    <div className="rounded-[28px] border border-[var(--line)] bg-[rgba(255,250,243,0.92)] p-5 shadow-[0_16px_40px_rgba(89,69,44,0.06)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="font-serif text-lg text-[var(--ink)]">{projectName}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">{activeModeMeta.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/projects" variant="secondary" size="sm">
            项目列表
          </ButtonLink>
          <DeleteProjectButton
            projectId={projectId}
            projectName={projectName}
            redirectTo="/projects"
            className="border border-[rgba(159,58,47,0.18)] bg-[rgba(159,58,47,0.08)] text-[#9f3a2f] hover:bg-[rgba(159,58,47,0.14)]"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {WORKBENCH_MODE_META.map((item) => (
          <ButtonLink
            key={item.value}
            href={`/projects/${projectId}?mode=${item.value}`}
            variant={item.value === activeMode ? "default" : "secondary"}
            size="sm"
          >
            {item.label}
          </ButtonLink>
        ))}
      </div>
    </div>
  );
}
