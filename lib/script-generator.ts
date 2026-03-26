import { getOpenAIClient, getScriptModel, hasOpenAIKey } from "@/lib/openai";
import { buildPairDynamics, conflictLevelLabel, personaModeLabel } from "@/lib/personas";
import {
  ConflictLevel,
  CreateEpisodeInput,
  Episode,
  EpisodeGenerationMemory,
  ScriptTurn,
  VoiceProfile,
} from "@/lib/types";

function makeEpisodeId() {
  return `ep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeTurn(id: number, speaker: "A" | "B", text: string): ScriptTurn {
  return {
    id: `turn-${id}`,
    speaker,
    text,
  };
}

function normalizeTopic(topic: string, sourceNotes: string) {
  return topic.trim() || sourceNotes.trim().slice(0, 40) || "AI 内容生产";
}

function estimateDuration(turns: ScriptTurn[]) {
  const totalChars = turns.reduce((sum, turn) => sum + turn.text.length, 0);
  const minutes = Math.max(6, Math.min(12, Math.round(totalChars / 95)));
  return `${minutes} min`;
}

function buildTitle(topic: string, template: string) {
  if (template === "news-breakdown") {
    return `${topic} 到底改变了什么`;
  }

  if (template === "opinion-duel") {
    return `关于“${topic}”，我们有一个不太一样的看法`;
  }

  return `${topic}，为什么值得做成双人播客`;
}

function buildSummary(topic: string, sourceNotes: string) {
  const notes = sourceNotes.trim();
  if (notes.length > 0) {
    return `围绕“${topic}”展开双人对话，并把输入资料压缩成更适合听觉消费的节目结构。`;
  }

  return `围绕“${topic}”展开一集双人对话，强调解释、追问与总结的节奏。`;
}

function buildShowPromptContext(input: CreateEpisodeInput) {
  return [
    `Show profile id: ${input.showProfileId || "custom-show"}`,
    `Show tagline: ${input.showTagline || "No tagline provided."}`,
    `Show cover image: ${input.showCoverImageUrl || "No cover image provided."}`,
    `Target audience: ${input.targetAudience || "General creators."}`,
    `Show format: ${input.showFormat || "Two-host podcast episode."}`,
    `Intro style: ${input.introStyle || "Start quickly and clearly."}`,
    `Outro style: ${input.outroStyle || "End with a practical takeaway."}`,
    `Default spoken intro: ${input.defaultIntro || "No default intro."}`,
    `Default spoken outro: ${input.defaultOutro || "No default outro."}`,
    `Default show description: ${input.defaultDescription || "No default description."}`,
  ].join("\n");
}

function buildShowAwareSummary(input: CreateEpisodeInput, topic: string, sourceNotes: string) {
  const base = buildSummary(topic, sourceNotes);
  const audience = input.targetAudience?.trim();
  const showDescription = input.defaultDescription?.trim();

  if (!audience && !showDescription) {
    return base;
  }

  return [base, audience ? `这集特别会照顾 ${audience} 的听感和理解路径。` : "", showDescription ? `节目基调参考：${showDescription}` : ""]
    .filter(Boolean)
    .join(" ");
}

function buildShowAwareCta(input: CreateEpisodeInput, topic: string) {
  const base = buildCta(topic);
  const outro = input.outroStyle?.trim();
  const defaultOutro = input.defaultOutro?.trim();

  if (!outro && !defaultOutro) {
    return base;
  }

  return [base, defaultOutro ? `默认收尾口径参考：${defaultOutro}` : "", outro ? `结尾语气参考：${outro}` : ""]
    .filter(Boolean)
    .join(" ");
}

function buildMemoryLine(host: VoiceProfile) {
  return [
    `biases: ${host.worldviewBiases.join(", ")}`,
    `recurring angles: ${host.recurringAngles.join(", ")}`,
    `avoid phrases: ${host.bannedPhrases.join(", ")}`,
  ].join(" | ");
}

function buildContinuityLine(memory: EpisodeGenerationMemory["hostA"]) {
  if (!memory.length) {
    return "No recent episode continuity available.";
  }

  return memory
    .map((entry, index) => {
      const lines = entry.sampleLines.length ? ` sample lines: ${entry.sampleLines.join(" / ")}` : "";
      return `${index + 1}. ${entry.title} - ${entry.summary}${lines}`;
    })
    .join("\n");
}

function buildScript(
  topic: string,
  sourceNotes: string,
  hostA: VoiceProfile,
  hostB: VoiceProfile,
  template: string,
  conflictLevel: ConflictLevel,
  memory?: EpisodeGenerationMemory,
): ScriptTurn[] {
  const pairDynamics = buildPairDynamics(hostA, hostB, conflictLevel);
  const notesSnippet =
    sourceNotes.trim().length > 0
      ? `我先抓一下输入资料里的主线，它其实在讲：${sourceNotes.trim().slice(0, 72)}。`
      : `如果把这个主题讲给第一次接触的人听，我们最先要回答的是它为什么现在值得聊。`;
  const hostAMemoryCue = memory?.hostA[0]?.summary;
  const hostBMemoryCue = memory?.hostB[0]?.summary;

  if (pairDynamics.mode === "reality-mode") {
    const challengeOpeners = {
      low: "我想先替听众追问一句",
      medium: "先等一下",
      high: "等等，这里我得直接打断一下",
    } satisfies Record<ConflictLevel, string>;
    const pushbackLines = {
      low: "这个方向我基本认同，但普通创作者最先会遇到的现实障碍到底是什么？",
      medium: "这种说法听起来很漂亮，但现实一点看，普通创作者最先撞上的问题到底是什么？",
      high: "这话听起来很顺，但现实里很多人根本拿不到结果，最先撞上的问题到底是什么？",
    } satisfies Record<ConflictLevel, string>;
    const doubtLines = {
      low: "我理解这个结构，不过如果执行成本太高，很多人还是会停在理解阶段。",
      medium: "但这真的会变成结果吗？很多人其实卡在执行，不是卡在理解。",
      high: "但这真的会变成结果吗？如果执行层面跑不通，这整套逻辑就只是好听，不是好用。",
    } satisfies Record<ConflictLevel, string>;
    const tensionLine = {
      low: "我认同结构，只是最后还是得回到一个问题，这套方法有没有让开始行动变得更容易。",
      medium: "我认同结构，但如果没人愿意持续做，这套东西还是会停在“看起来有道理”。",
      high: "我认同结构，但如果不能逼出行动，这套东西本质上还是一种自我安慰，不是生产系统。",
    } satisfies Record<ConflictLevel, string>;

    return [
      makeTurn(1, "A", `今天我们聊“${topic}”。如果拆开来看，这个题目真正值得讨论的，不是工具多酷，而是它到底有没有改变创作者的生产结果。`),
      makeTurn(2, "B", `${challengeOpeners[conflictLevel]}，${pushbackLines[conflictLevel]}`),
      makeTurn(3, "A", notesSnippet),
      makeTurn(4, "B", doubtLines[conflictLevel]),
      makeTurn(5, "A", `对，所以关键点其实有三层：理解发生了什么、判断值不值得做、再决定今天先落哪一步。${hostAMemoryCue ? ` 这也跟我们前面反复提到的那件事一致：${hostAMemoryCue.slice(0, 24)}。` : ""}`),
      makeTurn(6, "B", tensionLine[conflictLevel]),
      makeTurn(7, "A", `${hostA.name} 负责把逻辑铺开，${hostB.name} 这种质疑型搭档则会逼着我们把话说到更现实的位置。${hostBMemoryCue ? ` 他最近其实一直在追同一个点：${hostBMemoryCue.slice(0, 22)}。` : ""}`),
      makeTurn(8, "A", `所以最后的 takeaway 很简单，别只问 AI 能不能做内容，而要问这套流程能不能真的替你省时间、换结果。`),
    ];
  }

  if (pairDynamics.mode === "insight-mode") {
    const reflectionLine = {
      low: "换句话说，它更像是在提醒我们，创作里真正稀缺的仍然是判断，而不是生成本身。",
      medium: "换句话说，重点可能不只是效率更高，而是人终于可以把精力放回判断和表达本身。",
      high: "换句话说，如果我们还把注意力只放在效率上，可能恰好忽略了这件事最深的变化。",
    } satisfies Record<ConflictLevel, string>;
    const synthesisLine = {
      low: "如果只记住一句话，那就是工具在变轻，但表达的重量并没有消失。",
      medium: "如果只记住一句话，那就是工具在压缩执行成本，但判断力的价值反而更高了。",
      high: "如果只记住一句话，那就是成本会被压平，但没有观点的人仍然会被快速淘汰。",
    } satisfies Record<ConflictLevel, string>;

    return [
      makeTurn(1, "A", `今天我们聊“${topic}”。如果拆开来看，这件事最值得注意的，是它正在重新定义内容生产里的分工。`),
      makeTurn(2, "B", reflectionLine[conflictLevel]),
      makeTurn(3, "A", notesSnippet),
      makeTurn(4, "B", `这也是为什么很多看起来只是工具升级的变化，最后会演变成创作方式的变化。`),
      makeTurn(5, "A", `所以关键点其实不是“要不要用”，而是你准备把它放在流程的哪一段。${hostAMemoryCue ? ` 这和我们一直强调的那条线也连得上：${hostAMemoryCue.slice(0, 24)}。` : ""}`),
      makeTurn(6, "B", `${synthesisLine[conflictLevel]}${hostBMemoryCue ? ` 这也延续了我们最近一直在收的那个结论：${hostBMemoryCue.slice(0, 22)}。` : ""}`),
      makeTurn(7, "A", `所以这集的最后结论是，真正值得建立的不是一次性的技巧，而是一套能持续产出观点的节目结构。`),
    ];
  }

  if (template === "news-breakdown") {
    return [
      makeTurn(1, "A", `今天我们想聊的是“${topic}”。先别急着下结论，这件事真正值得看的不是表面新闻，而是它背后的变化速度。`),
      makeTurn(2, "B", `那我们先帮听众卡一个点，这到底是一条短期热点，还是一个已经会影响创作者生产方式的信号？`),
      makeTurn(3, "A", notesSnippet),
      makeTurn(4, "B", `我听下来最关键的不是信息本身，而是它会不会改变大家做内容、做分发、做变现的方式。`),
      makeTurn(5, "A", `对，所以我们不妨把它拆成三层：发生了什么、为什么现在发生、普通创作者应该怎么用。`),
      makeTurn(6, "B", `最后我也想追问一个现实问题，如果今天就想把它用起来，第一步到底该做什么，而不是继续围观。`),
    ];
  }

  if (template === "opinion-duel") {
    return [
      makeTurn(1, "A", `我先抛一个观点，关于“${topic}”，很多人把重点放错了。真正稀缺的不是工具，而是可持续的节目结构。`),
      makeTurn(2, "B", `等一下，这句话会不会太绝对？很多人连工具都还没摸清楚，怎么会先输在结构上？`),
      makeTurn(3, "A", `因为工具会越来越便宜，但听众愿不愿意留下来，取决于你有没有让两位主持人形成互相推动的关系。`),
      makeTurn(4, "B", `也就是说，一个人负责讲清楚，另一个人负责把听众心里的疑问说出来，这个拉扯感才是节目感。`),
      makeTurn(5, "A", notesSnippet),
      makeTurn(6, "B", `所以如果今天开始做，我反而建议先固定人设、固定栏目、固定长度，再去追最强模型。`),
    ];
  }

  return [
    makeTurn(1, "A", `今天这集我们想把“${topic}”讲得更像一段能听完的聊天，而不是一篇被念出来的文章。`),
    makeTurn(2, "B", `那我先替听众问一句，为什么这个题目一定要用双人形式？单人讲清楚不行吗？`),
    makeTurn(3, "A", `单人当然也可以讲，但双人结构更容易制造节奏，一个人负责展开，另一个人负责追问、打断和总结。`),
    makeTurn(4, "B", `也就是说，听众不是只接收信息，而是在听一个理解过程，这会比平铺直叙更自然。`),
    makeTurn(5, "A", notesSnippet),
    makeTurn(6, "B", `如果把这件事落到创作动作上，我会建议先定主题边界，再定两位主持人的关系，而不是先堆功能。`),
    makeTurn(7, "A", `${hostA.name} 这种主讲型声音适合把背景和逻辑铺开，${hostB.name} 这种搭档型声音则负责把抽象内容拉回真实听感。`),
    makeTurn(8, "B", `所以这集最后的结论其实很简单，想做好 AI 播客，不只是生成内容，而是设计一段值得被听完的对话。`),
  ];
}

type StructuredEpisodeDraft = {
  title: string;
  summary: string;
  showNotes: string[];
  cta: string;
  turns: Array<{
    speaker: "A" | "B";
    text: string;
  }>;
};

function cleanupSpokenChinese(text: string) {
  return text
    .replace(/，因此/g, "，所以")
    .replace(/，然而/g, "，但")
    .replace(/，与此同时/g, "，同时")
    .replace(/换句话说，换句话说/g, "换句话说")
    .replace(/总的来说/g, "所以最后")
    .replace(/事实上/g, "其实")
    .replace(/\s+/g, " ")
    .trim();
}

function polishTurnsLocally(turns: StructuredEpisodeDraft["turns"]) {
  return turns.map((turn, index, list) => {
    let text = cleanupSpokenChinese(turn.text);
    const prev = list[index - 1];

    if (prev && prev.speaker !== turn.speaker && text === cleanupSpokenChinese(prev.text)) {
      text = `${text}，但重点不太一样。`;
    }

    if (text.length > 70 && !text.includes("，")) {
      text = text.replace(/(.{22})(?=.)/, "$1，");
    }

    return {
      ...turn,
      text,
    };
  });
}

function polishStructuredDraftLocally(draft: StructuredEpisodeDraft): StructuredEpisodeDraft {
  return {
    ...draft,
    title: cleanupSpokenChinese(draft.title),
    summary: cleanupSpokenChinese(draft.summary),
    showNotes: draft.showNotes.map((note) => cleanupSpokenChinese(note)),
    cta: cleanupSpokenChinese(draft.cta),
    turns: polishTurnsLocally(draft.turns),
  };
}

async function polishStructuredDraftWithOpenAI(
  draft: StructuredEpisodeDraft,
  hostA: VoiceProfile,
  hostB: VoiceProfile,
  conflictLevel: ConflictLevel,
) {
  const client = getOpenAIClient();

  const response = await client.responses.create({
    model: getScriptModel(),
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are polishing a Chinese two-host podcast script. Keep the meaning and structure, but make it sound more spoken, more natural, and less like AI-written prose.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Host A: ${hostA.name} (${hostA.role})`,
              `Host B: ${hostB.name} (${hostB.role})`,
              `Conflict level: ${conflictLevelLabel(conflictLevel)}`,
              "Polish goals:",
              "- Keep the same overall message, order, and speaker assignment.",
              "- Keep 8 to 12 turns.",
              "- Make the lines easier to say aloud.",
              "- Reduce repetitive sentence openings and AI-sounding transitions.",
              "- Shorten over-explained lines.",
              "- Preserve the hosts' personas and tension level.",
              "Return the same JSON shape.",
              `Draft JSON:\n${JSON.stringify(draft)}`,
            ].join("\n"),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "polished_podcast_episode_script",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            showNotes: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: { type: "string" },
            },
            cta: { type: "string" },
            turns: {
              type: "array",
              minItems: 8,
              maxItems: 12,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  speaker: {
                    type: "string",
                    enum: ["A", "B"],
                  },
                  text: {
                    type: "string",
                  },
                },
                required: ["speaker", "text"],
              },
            },
          },
          required: ["title", "summary", "showNotes", "cta", "turns"],
        },
      },
    },
  });

  return JSON.parse(response.output_text) as StructuredEpisodeDraft;
}

function buildShowNotes(topic: string, sourceNotes: string) {
  if (sourceNotes.trim()) {
    return [
      `本集围绕“${topic}”展开，并把输入资料转成更适合听觉消费的对话结构。`,
      "双人主持的重点是让解释、追问和总结彼此配合，而不是轮流念稿。",
      "节目里最好保留一个具体例子和一个最终 takeaway，方便听众记住核心观点。",
    ];
  }

  return [
    `本集讨论“${topic}”为什么适合做成双人对话节目。`,
    "主持人 A 负责铺陈逻辑，主持人 B 负责替听众卡住重点和疑问。",
    "比起信息堆叠，真正决定听感的是张力、停顿和总结节奏。",
  ];
}

function buildCta(topic: string) {
  return `如果你也想做“${topic}”相关内容，先固定两位主持人的角色分工，再开始批量生成。`;
}

function buildEpisodeFromTurns(
  input: CreateEpisodeInput,
  hostA: VoiceProfile,
  hostB: VoiceProfile,
  topic: string,
  script: ScriptTurn[],
  generationMode: Episode["generationMode"],
  title?: string,
  summary?: string,
  showNotes?: string[],
  cta?: string,
): Episode {
  return {
    id: makeEpisodeId(),
    title: title || buildTitle(topic, input.template),
    showName: input.showName.trim() || "Untitled Show",
    summary: summary || buildShowAwareSummary(input, topic, input.sourceNotes),
    showNotes: showNotes || buildShowNotes(topic, input.sourceNotes),
    cta: cta || buildShowAwareCta(input, topic),
    sourceType: input.sourceNotes.trim() ? "article" : "topic",
    sourceContent: input.sourceNotes.trim() || topic,
    template: input.template,
    durationLabel: estimateDuration(script),
    status: "script_ready",
    updatedAt: new Date().toLocaleString("zh-CN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    hostA,
    hostB,
    script,
    generationMode,
  };
}

async function generateStructuredScript(
  input: CreateEpisodeInput,
  hostA: VoiceProfile,
  hostB: VoiceProfile,
  topic: string,
  memory?: EpisodeGenerationMemory,
) {
  const client = getOpenAIClient();
  const conflictLevel = input.conflictLevel ?? "medium";
  const pairDynamics = buildPairDynamics(hostA, hostB, conflictLevel);
  const templateInstruction =
    input.template === "news-breakdown"
      ? "Use a news-analysis rhythm: headline, context, implications, practical takeaway."
      : input.template === "opinion-duel"
        ? "Use a tension-driven debate rhythm: strong thesis, challenge, clarification, useful resolution."
        : "Use an insight-chat rhythm: hook, concept explanation, examples, listener-oriented takeaway.";

  const response = await client.responses.create({
    model: getScriptModel(),
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are writing a Chinese podcast script for two hosts. The result must sound like a natural conversation, not alternating essay paragraphs. Keep each line concise, specific, and easy to speak aloud.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Show name: ${input.showName || "Future Banter"}`,
              buildShowPromptContext(input),
              `Topic: ${topic}`,
              `Source notes: ${input.sourceNotes || "No extra notes provided."}`,
              `Template: ${input.template}`,
              `Persona pairing: ${personaModeLabel(pairDynamics.mode)}`,
              `Conflict level: ${conflictLevelLabel(conflictLevel)}`,
              `Host A name: ${hostA.name}`,
              `Host A persona: ${hostA.persona}; style: ${hostA.style}`,
              `Host A role: ${hostA.role}`,
              `Host A personality: ${hostA.personality.join(", ")}`,
              `Host A speaking style: ${hostA.speakingStyle.join(", ")}`,
              `Host A signature phrases: ${hostA.signaturePhrases.join(", ")}`,
              `Host A conversation goals: ${hostA.conversationGoals.join(", ")}`,
              `Host A constraints: ${hostA.constraints.join(", ")}`,
              `Host A memory: ${buildMemoryLine(hostA)}`,
              `Host A recent episode continuity:\n${buildContinuityLine(memory?.hostA ?? [])}`,
              `Host B name: ${hostB.name}`,
              `Host B persona: ${hostB.persona}; style: ${hostB.style}`,
              `Host B role: ${hostB.role}`,
              `Host B personality: ${hostB.personality.join(", ")}`,
              `Host B speaking style: ${hostB.speakingStyle.join(", ")}`,
              `Host B signature phrases: ${hostB.signaturePhrases.join(", ")}`,
              `Host B conversation goals: ${hostB.conversationGoals.join(", ")}`,
              `Host B constraints: ${hostB.constraints.join(", ")}`,
              `Host B memory: ${buildMemoryLine(hostB)}`,
              `Host B recent episode continuity:\n${buildContinuityLine(memory?.hostB ?? [])}`,
              "Goal: create a 6-12 minute episode with clear pacing and listener-friendly flow.",
              "Constraints:",
              "- Return 8 to 12 dialogue turns.",
              "- Alternate speakers naturally, starting with A.",
              "- End with Host A delivering the final takeaway in one concise closing turn.",
              "- The opening should match the show's intro style and audience expectations.",
              "- When useful, lightly echo the show's default spoken intro near the beginning, but do not make it sound copy-pasted.",
              "- The closing should match the show's outro style and overall brand voice.",
              "- When useful, let the final closing rhythm echo the show's default spoken outro, but keep it natural.",
              "- The conversation should feel like one recurring show identity, not a generic demo.",
              "- Host A explains and drives the story.",
              "- Host B must not merely paraphrase Host A. Each Host B turn must either challenge, reframe, ground with reality, or sharpen the takeaway.",
              "- Let each host sound like the same recurring person across episodes, with consistent preferences, recurring angles, and verbal habits.",
              "- When relevant, lightly echo the host's recent concerns or obsessions, but do not sound repetitive and do not explicitly say 'in a previous episode'.",
              "- Use signature phrases sparingly. At most one obvious signature phrase per host in the whole script.",
              "- Respect each host's banned phrases and worldview biases.",
              `- Conflict intensity should match ${conflictLevelLabel(conflictLevel)}.`,
              "- Include at least one challenge, one concrete example, and one closing takeaway.",
              "- Write spoken Chinese, not essay Chinese. Avoid polished article transitions.",
              "- Vary sentence length. Mix short interruptions with medium explanation lines.",
              "- At least one turn should feel like a natural interruption or sharp follow-up.",
              `- Pair dynamics: ${pairDynamics.dynamics}`,
              `- Pacing rule: ${pairDynamics.pacing}`,
              "- Provide 3 concise show notes bullets and 1 short CTA for the episode description.",
              `- ${templateInstruction}`,
            ].join("\n"),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "podcast_episode_script",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            showNotes: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: {
                type: "string",
              },
            },
            cta: { type: "string" },
            turns: {
              type: "array",
              minItems: 8,
              maxItems: 12,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  speaker: {
                    type: "string",
                    enum: ["A", "B"],
                  },
                  text: {
                    type: "string",
                  },
                },
                required: ["speaker", "text"],
              },
            },
          },
          required: ["title", "summary", "showNotes", "cta", "turns"],
        },
      },
    },
  });

  return JSON.parse(response.output_text) as StructuredEpisodeDraft;
}

export async function generateEpisodeFromInput(
  input: CreateEpisodeInput,
  hostA: VoiceProfile,
  hostB: VoiceProfile,
  memory?: EpisodeGenerationMemory,
): Promise<Episode> {
  const topic = normalizeTopic(input.topic, input.sourceNotes);
  const conflictLevel = input.conflictLevel ?? "medium";

  if (hasOpenAIKey()) {
    try {
      const structured = await generateStructuredScript(input, hostA, hostB, topic, memory);
      const locallyPolished = polishStructuredDraftLocally(structured);
      const polished =
        hasOpenAIKey()
          ? await polishStructuredDraftWithOpenAI(locallyPolished, hostA, hostB, conflictLevel).catch(
              () => locallyPolished,
            )
          : locallyPolished;
      const script = polished.turns.map((turn, index) =>
        makeTurn(index + 1, turn.speaker, turn.text.trim()),
      );

      return buildEpisodeFromTurns(
        input,
        hostA,
        hostB,
        topic,
        script,
        "openai",
        polished.title.trim(),
        polished.summary.trim(),
        polished.showNotes.map((note) => note.trim()),
        polished.cta.trim(),
      );
    } catch (error) {
      console.error("OpenAI script generation failed, falling back to local generator.", error);
    }
  }

  const fallbackDraft = {
    title: buildTitle(topic, input.template),
    summary: buildSummary(topic, input.sourceNotes),
    showNotes: buildShowNotes(topic, input.sourceNotes),
    cta: buildCta(topic),
    turns: buildScript(
      topic,
      input.sourceNotes,
      hostA,
      hostB,
      input.template,
      conflictLevel,
      memory,
    ).map((turn) => ({
      speaker: turn.speaker,
      text: turn.text,
    })),
  } satisfies StructuredEpisodeDraft;
  const polishedFallback = polishStructuredDraftLocally(fallbackDraft);
  const fallbackScript = polishedFallback.turns.map((turn, index) =>
    makeTurn(index + 1, turn.speaker, turn.text),
  );

  return buildEpisodeFromTurns(
    input,
    hostA,
    hostB,
    topic,
    fallbackScript,
    "fallback",
    polishedFallback.title,
    polishedFallback.summary,
    polishedFallback.showNotes,
    polishedFallback.cta,
  );
}
