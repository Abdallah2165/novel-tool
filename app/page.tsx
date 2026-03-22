import { SectionPanel } from "@/components/section-panel";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";

export default function HomePage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.45fr_0.95fr]">
      <SectionPanel
        title="从想法到成稿，按中文工作流推进你的小说项目"
        description="这里不是纯聊天生成器，而是围绕“资料吸收 -> 设定 -> 大纲 -> 章节 -> 审稿 -> 回填”组织的作者后台。AI 结果先进入草稿，确认后再回填正式版本。"
        className="paper-grid overflow-hidden"
        action={<Badge>作者工作流已接通</Badge>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.58)] p-5">
            <p className="text-xs tracking-[0.24em] text-[var(--muted-ink)] uppercase">开工方式</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-soft)]">
              <div className="rounded-2xl bg-[var(--paper)] p-4">
                <p className="text-sm text-[var(--ink)]">1. 新建项目</p>
                <p className="mt-2">支持空白创建，也支持 AI 一问一答式初始化，把题材、平台、冲突和风格先沉淀成标准文件。</p>
              </div>
              <div className="rounded-2xl bg-[var(--paper)] p-4">
                <p className="text-sm text-[var(--ink)]">2. 进入工作台</p>
                <p className="mt-2">任务执行、正文写作、审阅改稿、任务中心、Prompt Studio 和导出中心已经打通到同一套项目数据。</p>
              </div>
              <div className="rounded-2xl bg-[var(--paper)] p-4">
                <p className="text-sm text-[var(--ink)]">3. 草稿先行</p>
                <p className="mt-2">所有生成先落 Draft，再决定是否接受并回填到正式 revision，避免剧情和状态文件被直接覆盖。</p>
              </div>
            </div>
          </div>
          <div className="rounded-[24px] border border-[var(--line)] bg-[rgba(255,248,238,0.72)] p-5">
            <p className="text-xs tracking-[0.24em] text-[var(--muted-ink)] uppercase">现在可以直接做的事</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-[var(--paper)] p-4">
                <p className="text-lg text-[var(--ink)]">双模式创建</p>
                <p className="mt-2 leading-6 text-[var(--muted-ink)]">支持 AI 引导创建，也支持空白项目 + 作者材料上传。</p>
              </div>
              <div className="rounded-2xl bg-[var(--paper)] p-4">
                <p className="text-lg text-[var(--ink)]">任务闭环</p>
                <p className="mt-2 leading-6 text-[var(--muted-ink)]">资料吸收、设定、大纲、章节、审稿、回填已经串在同一工作台里。</p>
              </div>
              <div className="rounded-2xl bg-[var(--paper)] p-4">
                <p className="text-lg text-[var(--ink)]">模型切换</p>
                <p className="mt-2 leading-6 text-[var(--muted-ink)]">可以按写作、审稿、考据保存 API 预设，并在项目里切换。</p>
              </div>
              <div className="rounded-2xl bg-[var(--paper)] p-4">
                <p className="text-lg text-[var(--ink)]">部署就绪</p>
                <p className="mt-2 leading-6 text-[var(--muted-ink)]">已经补上 Docker、自动发布、远端验活、回滚和部署诊断留档。</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
              现在可以直接进入项目、使用 AI 引导初始化、保存 API 预设，并在工作台里按中文任务流推进，不再需要先理解内部研发说明。
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/projects/new" variant="default">
            开始新建项目
          </ButtonLink>
          <ButtonLink href="/projects" variant="secondary">
            查看项目列表
          </ButtonLink>
        </div>
      </SectionPanel>

      <SectionPanel
        title="现在适合怎么用"
        description="如果你是作者或编辑，可以直接把它当成小说项目后台使用，而不是先理解内部研发结构。"
      >
        <div className="space-y-4 text-sm leading-7 text-[var(--ink-soft)]">
          <div className="rounded-[22px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="font-medium text-[var(--ink)]">如果你刚开始立项</p>
            <p className="mt-2">先用“AI 引导创建”梳理题材、平台、主角目标、世界规则和写作边界，再进入工作台继续补全。</p>
          </div>
          <div className="rounded-[22px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="font-medium text-[var(--ink)]">如果你已经有设定或资料</p>
            <p className="mt-2">直接新建空白项目，先上传 txt / md / html 资料，再执行“资料吸收”“设定生成”“大纲生成”。</p>
          </div>
          <div className="rounded-[22px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="font-medium text-[var(--ink)]">如果你已经在写正文</p>
            <p className="mt-2">切到正文写作或审阅改稿模式，让 AI 先生成草稿，再决定是否接受并回填到正式版本。</p>
          </div>
          <div className="rounded-[22px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="font-medium text-[var(--ink)]">如果你需要切模型</p>
            <p className="mt-2">在设置页配置 endpoint，然后为写作、审稿、考据分别保存项目级 API 预设，后续在工作台一键切换。</p>
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}
