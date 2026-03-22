import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { SectionPanel } from "@/components/section-panel";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { getProjectSnapshots } from "@/lib/scaffold-data";
import { resolveHeadersUser } from "@/lib/auth/identity";
import { getTaskLabel } from "@/lib/tasks/catalog";

export const dynamic = "force-dynamic";

function formatTime(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function ProjectsPage() {
  const user = await resolveHeadersUser(await headers()).catch(() => null);

  if (!user) {
    redirect("/login");
  }

  const projects = await getProjectSnapshots(user.id);

  return (
    <div className="space-y-6">
      <SectionPanel
        title="项目列表"
        description="浏览当前账号下的项目、继续写作、检查资料和版本历史。"
        action={
          <ButtonLink href="/projects/new" variant="default">
            新建项目
          </ButtonLink>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-[var(--line)] bg-[rgba(255,250,242,0.75)] p-6 text-sm leading-7 text-[var(--muted-ink)]">
              还没有项目。先去创建一个项目，后续生成、草稿和版本历史都会进入你的真实账号空间。
            </div>
          ) : null}
          {projects.map((project) => (
            <article
              key={project.id}
              className="rounded-[28px] border border-[var(--line)] bg-[rgba(255,250,242,0.85)] p-5 transition-transform hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(79,58,36,0.08)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl text-[var(--ink)]">
                    <Link href={`/projects/${project.id}`} className="transition-colors hover:text-[var(--ink-soft)]">
                      {project.name}
                    </Link>
                  </h2>
                  <p className="mt-2 text-sm text-[var(--muted-ink)]">
                    {project.genre} · {project.platform}
                  </p>
                </div>
                <Badge>{getTaskLabel(project.preference?.defaultTaskType ?? "workflow_check")}</Badge>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-2xl bg-[var(--paper)] p-3">
                  <p className="text-lg text-[var(--ink)]">{project._count.artifacts}</p>
                  <p className="text-xs text-[var(--muted-ink)]">项目文件</p>
                </div>
                <div className="rounded-2xl bg-[var(--paper)] p-3">
                  <p className="text-lg text-[var(--ink)]">{project._count.references}</p>
                  <p className="text-xs text-[var(--muted-ink)]">资料</p>
                </div>
                <div className="rounded-2xl bg-[var(--paper)] p-3">
                  <p className="text-lg text-[var(--ink)]">{project._count.drafts}</p>
                  <p className="text-xs text-[var(--muted-ink)]">草稿</p>
                </div>
              </div>
              <p className="mt-5 text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">
                最近更新 {formatTime(project.updatedAt)}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <ButtonLink href={`/projects/${project.id}`} variant="default" size="sm">
                  进入项目
                </ButtonLink>
                <DeleteProjectButton
                  projectId={project.id}
                  projectName={project.name}
                  className="border border-[rgba(159,58,47,0.18)] bg-[rgba(159,58,47,0.08)] text-[#9f3a2f] hover:bg-[rgba(159,58,47,0.14)]"
                />
              </div>
            </article>
          ))}
        </div>
      </SectionPanel>
    </div>
  );
}
