import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SectionPanel } from "@/components/section-panel";
import { LoginForm } from "@/components/auth/login-form";
import { resolveHeadersUser } from "@/lib/auth/identity";
import { env } from "@/lib/env";

export default async function LoginPage() {
  const user = await resolveHeadersUser(await headers()).catch(() => null);
  const linuxDoEnabled = Boolean(env.LINUX_DO_CLIENT_ID?.trim() && env.LINUX_DO_CLIENT_SECRET?.trim());

  if (user) {
    redirect("/projects");
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <SectionPanel
        title="回到你的小说后台"
        description="登录后继续管理项目、切换模型配置、查看草稿和历史版本。支持邮箱密码，也支持接入 Linux DO 登录。"
        className="paper-grid min-h-[520px]"
      >
        <LoginForm linuxDoEnabled={linuxDoEnabled} />
      </SectionPanel>

      <SectionPanel
        title="这套后台的默认心智"
        description="像番茄 / 起点作者后台那样克制，不堆满干扰卡片，把视线留给正文。"
      >
        <ul className="space-y-4 text-sm leading-7 text-[var(--ink-soft)]">
          <li>1. 所有生成先落草稿，不直接覆盖正式文件。</li>
          <li>2. 审稿永远按“问题 {">"} 证据 {">"} 最小修法”输出。</li>
          <li>3. 状态卡和进度文件优先于聊天上下文。</li>
          <li>4. 联网只用于真实世界事实补充，不覆盖剧情事实。</li>
        </ul>
      </SectionPanel>
    </div>
  );
}
