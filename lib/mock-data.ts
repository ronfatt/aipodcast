import { Episode, VoiceProfile } from "@/lib/types";

export const voiceProfiles: VoiceProfile[] = [
  {
    id: "host-lin",
    name: "Lin",
    persona: "冷静主讲",
    style: "解释清楚，铺陈有层次",
    sampleLine: "我们先把这件事拆开来看，别急着下结论。",
    systemVoice: "Tingting",
  },
  {
    id: "host-jay",
    name: "Jay",
    persona: "追问型搭档",
    style: "反应快，会打断，会帮听众问问题",
    sampleLine: "等一下，这里普通听众最可能卡住的点是什么？",
    systemVoice: "Sin-ji",
  },
  {
    id: "host-mika",
    name: "Mika",
    persona: "活泼观察者",
    style: "节奏轻快，擅长举例",
    sampleLine: "这个地方我想给一个很生活化的例子。",
    systemVoice: "Meijia",
  },
  {
    id: "host-ren",
    name: "Ren",
    persona: "总结型主持",
    style: "把复杂信息压缩成重点",
    sampleLine: "如果只记住一件事，那就是它的成本正在被重写。",
    systemVoice: "Tingting",
  },
];

export const sampleEpisodes: Episode[] = [
  {
    id: "ep-001",
    title: "AI 新闻不该做成资讯念稿",
    showName: "Future Banter",
    summary: "讨论为什么双人结构比单人播报更适合 AI 内容节目。",
    showNotes: [
      "双人播客的核心不是两个人轮流读稿，而是角色之间的信息张力。",
      "主持人 A 负责展开论点，主持人 B 负责替听众追问和总结。",
      "自然打断、短句和段落总结会让 AI 播客更像节目而不是摘要。",
    ],
    cta: "如果你也在做 AI 内容，先从固定两位主持人的关系开始设计。",
    sourceType: "topic",
    sourceContent: "为什么很多 AI 播客听起来像在念摘要，以及双人结构如何改善留存。",
    template: "insight-chat",
    durationLabel: "8 min",
    status: "script_ready",
    updatedAt: "2026-03-23 12:40",
    hostA: voiceProfiles[0],
    hostB: voiceProfiles[1],
    script: [
      {
        id: "turn-1",
        speaker: "A",
        text: "今天我们聊一个很关键的问题，为什么很多 AI 播客听起来像在念摘要。",
      },
      {
        id: "turn-2",
        speaker: "B",
        text: "因为它们没有对话，只是在把文章切成两份轮流读，对吧？",
      },
      {
        id: "turn-3",
        speaker: "A",
        text: "对，所以真正的重点不是双人，而是角色之间有没有信息张力。",
      },
      {
        id: "turn-4",
        speaker: "B",
        text: "也就是一个人负责展开，另一个人负责帮听众卡重点、提问题、做转场。",
      },
    ],
  },
  {
    id: "ep-002",
    title: "把长文章改成 10 分钟播客的结构",
    showName: "Future Banter",
    summary: "从资料输入到脚本分段，梳理 V1 内容生产流程。",
    showNotes: [
      "长文章不适合直接转语音，先拆成三到五个对话任务会更自然。",
      "每个段落都应该有一个明确目标，例如解释、追问或总结。",
      "10 分钟节目最重要的是节奏控制，而不是信息堆叠。",
    ],
    cta: "先把输入资料压缩成清晰段落，再决定每位主持人的职责。",
    sourceType: "article",
    sourceContent: "如何把长文章、研究笔记或资讯稿转成 10 分钟双人对话节目。",
    template: "news-breakdown",
    durationLabel: "10 min",
    status: "script_ready",
    updatedAt: "2026-03-23 10:15",
    hostA: voiceProfiles[2],
    hostB: voiceProfiles[3],
    script: [
      {
        id: "turn-5",
        speaker: "A",
        text: "如果源材料很长，第一步不是直接写稿，而是先切成三到五个对话段落。",
      },
      {
        id: "turn-6",
        speaker: "B",
        text: "这样每一段才有一个明确任务，不会一路解释到听众走神。",
      },
    ],
  },
];
