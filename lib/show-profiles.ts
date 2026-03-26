import { ShowProfile } from "@/lib/types";

export const showProfiles: ShowProfile[] = [
  {
    id: "future-banter",
    name: "Future Banter",
    tagline: "用双人对话把 AI 与创作趋势聊清楚。",
    category: "AI / Creator Economy",
    coverImageUrl:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
    format: "8-12 分钟，双人结构，解释 + 追问 + takeaway",
    audience: "想把 AI 用进内容生产的创作者和独立创业者",
    publishingCadence: "每周 2-3 集",
    introStyle: "冷启动，直接抛问题，30 秒内告诉听众这集为什么值得听。",
    outroStyle: "收成一个 takeaway，再给一个可执行动作。",
    defaultIntro: "这里是 Future Banter，我们用双人对话把变化拆开来看。",
    defaultOutro: "如果这集对你有用，下一步就把一个想法真的跑起来。",
    defaultDescription: "聚焦 AI、创作者工具和内容工作流，用双人对话压缩成更耐听的判断。",
    backgroundMusicLevel: "subtle",
    template: "news-breakdown",
    personaMode: "reality-mode",
    conflictLevel: "medium",
    hostAId: "host-lin",
    hostBId: "host-jay",
  },
  {
    id: "ai-creator-truth-booth",
    name: "AI 创作者真话局",
    tagline: "不聊虚火，只拆 AI 内容生意里真正有用的部分。",
    category: "AI / Media / Business",
    coverImageUrl:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    format: "8-10 分钟，主讲 + 质疑，现实导向",
    audience: "关注流量、变现和执行落地的中文内容创作者",
    publishingCadence: "每周 3 集",
    introStyle: "开场直接抛结论或争议点，迅速建立张力。",
    outroStyle: "落回现实动作，提醒听众别只停在观点层。",
    defaultIntro: "这里是 AI 创作者真话局，我们只聊真正会影响结果的东西。",
    defaultOutro: "别停在观点层，回去把最小的一步先做出来。",
    defaultDescription: "面向中文创作者，专聊 AI 内容、流量与执行落地里的现实问题。",
    backgroundMusicLevel: "balanced",
    template: "opinion-duel",
    personaMode: "reality-mode",
    conflictLevel: "high",
    hostAId: "host-lin",
    hostBId: "host-jay",
  },
  {
    id: "signal-summary",
    name: "Signal & Summary",
    tagline: "把工具变化翻译成更长线的创作判断。",
    category: "Insight / Strategy",
    coverImageUrl:
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
    format: "10 分钟左右，解释 + 升维总结",
    audience: "希望建立稳定内容系统的知识型创作者",
    publishingCadence: "每周 1-2 集",
    introStyle: "先点出变化，再快速解释这件事背后的意义。",
    outroStyle: "结尾要像节目金句，带一点升维感。",
    defaultIntro: "这里是 Signal & Summary，我们把工具变化翻译成更长线的内容判断。",
    defaultOutro: "真正重要的，不是工具更新，而是你如何重新安排自己的判断力。",
    defaultDescription: "面向知识型创作者的双人播客，聚焦工具变化背后的长期创作信号。",
    backgroundMusicLevel: "subtle",
    template: "insight-chat",
    personaMode: "insight-mode",
    conflictLevel: "low",
    hostAId: "host-lin",
    hostBId: "host-ren",
  },
];

export function getShowProfileById(id?: string) {
  return showProfiles.find((profile) => profile.id === id);
}

export function inferShowProfileByName(showName: string) {
  return showProfiles.find((profile) => profile.name === showName);
}
