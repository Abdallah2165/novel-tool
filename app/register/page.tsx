import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SectionPanel } from "@/components/section-panel";
import { RegisterForm } from "@/components/auth/register-form";
import { resolveHeadersUser } from "@/lib/auth/identity";
import { env } from "@/lib/env";

export default async function RegisterPage() {
  const user = await resolveHeadersUser(await headers()).catch(() => null);
  const linuxDoEnabled = Boolean(env.LINUX_DO_CLIENT_ID?.trim() && env.LINUX_DO_CLIENT_SECRET?.trim());

  if (user) {
    redirect("/projects");
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <SectionPanel
        title="创建写作工作区"
        description="注册后你会得到自己的项目列表、模型接口配置、MCP 配置和项目文件空间。支持邮箱注册，也支持 Linux DO 登录 / 注册。"
      >
        <RegisterForm linuxDoEnabled={linuxDoEnabled} />
      </SectionPanel>

      <SectionPanel
        title="项目初始化会自动创建什么"
        description="这些文件会在创建项目后自动建立，后续都通过草稿和历史版本维护。"
      >
        <div className="grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
          <div className="rounded-[22px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <code>story_background.md</code> / <code>world_bible.md</code> / <code>protagonist_card.md</code>
          </div>
          <div className="rounded-[22px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <code>writing_rules.md</code> / <code>task_plan.md</code> / <code>findings.md</code> / <code>progress.md</code>
          </div>
          <div className="rounded-[22px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <code>character_relationships.md</code> / <code>99_当前状态卡.md</code> / 编辑器元数据 JSON
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}
