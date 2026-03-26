import { getOpenAIClient, getScriptModel, hasOpenAIKey } from "@/lib/openai";
import { buildPairDynamics, conflictLevelLabel, personaModeLabel } from "@/lib/personas";
import {
  ConflictLevel,
  CreateEpisodeInput,
  Episode,
  EpisodeClip,
  EpisodeClipTag,
  EpisodeGenerationMemory,
  EpisodeAnalytics,
  EpisodeTextVariant,
  EpisodeVariantBundle,
  EpisodeVariantStyle,
  ScriptSegmentLabel,
  ScriptTurn,
  TopicScore,
  TopicScoringResult,
  VoiceProfile,
} from "@/lib/types";

const segmentBlueprint = [
  { label: "hook", title: "Hook", description: "Max 80 Chinese characters, immediate tension." },
  { label: "setup", title: "Setup", description: "Frame the topic and introduce the core conflict." },
  { label: "first_clash", title: "First Clash", description: "Host B challenges Host A directly." },
  { label: "reality_check", title: "Reality Check", description: "Bring in market, business, or audience behavior." },
  { label: "concrete_example", title: "Concrete Example", description: "Use one specific example or scenario." },
  { label: "reframe", title: "Reframe", description: "Move from surface debate to a deeper point." },
  { label: "final_takeaway", title: "Final Takeaway", description: "Compress the useful lesson clearly." },
  { label: "clip_line", title: "Clip Line", description: "End with a short clip-worthy closing line from Host A." },
] satisfies Array<{ label: ScriptSegmentLabel; title: string; description: string }>;

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

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
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
  variants: {
    titles: Array<{ style: EpisodeVariantStyle; text: string }>;
    hookLines: Array<{ style: EpisodeVariantStyle; text: string }>;
    ctas: Array<{ style: EpisodeVariantStyle; text: string }>;
    socialCaptions: Array<{ style: EpisodeVariantStyle; text: string }>;
    thumbnailTexts: Array<{ style: EpisodeVariantStyle; text: string }>;
  };
  turns: Array<{
    speaker: "A" | "B";
    segment: ScriptSegmentLabel;
    text: string;
  }>;
};

type StructuredTopicScore = {
  controversyScore: number;
  relevanceScore: number;
  audiencePainScore: number;
  clipabilityScore: number;
  monetizationScore: number;
  hookScore: number;
  overallScore: number;
  rationale: string;
  rewrites: string[];
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

function scoreTopicHeuristically(input: CreateEpisodeInput, topic: string): TopicScoringResult {
  const text = `${topic} ${input.sourceNotes}`.toLowerCase();
  const controversyIndicators = ["是不是", "会不会", "骗局", "真相", "误区", "没人", "为什么", "该不该"];
  const painIndicators = ["流量", "变现", "留存", "成本", "效率", "执行", "赚钱", "增长", "卡住"];
  const clipIndicators = ["真相", "误区", "没人", "别再", "为什么", "会不会", "该不该"];
  const monetizationIndicators = ["变现", "赚钱", "商业", "客户", "付费", "销售", "增长"];
  const relevanceIndicators = ["ai", "内容", "播客", "创作者", "短视频", "平台", "搜索", "品牌"];

  const controversyScore = clampScore(48 + controversyIndicators.filter((item) => text.includes(item)).length * 10);
  const relevanceScore = clampScore(52 + relevanceIndicators.filter((item) => text.includes(item)).length * 7);
  const audiencePainScore = clampScore(45 + painIndicators.filter((item) => text.includes(item)).length * 10);
  const clipabilityScore = clampScore(42 + clipIndicators.filter((item) => text.includes(item)).length * 10);
  const monetizationScore = clampScore(40 + monetizationIndicators.filter((item) => text.includes(item)).length * 12);
  const hookScore = clampScore(
    45 +
      (topic.includes("？") || topic.includes("?") ? 12 : 0) +
      (topic.length < 26 ? 10 : 0) +
      controversyIndicators.filter((item) => topic.includes(item)).length * 8,
  );
  const overallScore = clampScore(
    controversyScore * 0.18 +
      relevanceScore * 0.2 +
      audiencePainScore * 0.2 +
      clipabilityScore * 0.16 +
      monetizationScore * 0.12 +
      hookScore * 0.14,
  );

  const rewrites = [
    `为什么“${topic}”看起来很热，但大多数人做了还是没有结果？`,
    `关于“${topic}”，普通创作者最容易高估的地方到底是什么？`,
    `如果你想靠“${topic}”拿到真实结果，第一步最不该做错的是什么？`,
  ];

  return {
    topicScore: {
      controversyScore,
      relevanceScore,
      audiencePainScore,
      clipabilityScore,
      monetizationScore,
      hookScore,
      overallScore,
      rationale: "Heuristic scoring based on tension, pain-point language, relevance, and hook strength.",
    },
    rewrites,
    approved: overallScore >= 75,
  };
}

async function scoreTopicWithOpenAI(input: CreateEpisodeInput, topic: string) {
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
              "You are scoring podcast topics for viral potential and usefulness. Score the topic before script generation. Be strict and commercially realistic.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Show: ${input.showName}`,
              `Audience: ${input.targetAudience || "General creators"}`,
              `Topic: ${topic}`,
              `Source notes: ${input.sourceNotes || "No extra notes provided."}`,
              "Score this topic from 0 to 100 on:",
              "- controversy_score",
              "- relevance_score",
              "- audience_pain_score",
              "- clipability_score",
              "- monetization_score",
              "- hook_score",
              "- overall_score",
              "Also provide one short rationale and 3 stronger rewrites if the topic needs work.",
            ].join("\n"),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "podcast_topic_score",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            controversyScore: { type: "number" },
            relevanceScore: { type: "number" },
            audiencePainScore: { type: "number" },
            clipabilityScore: { type: "number" },
            monetizationScore: { type: "number" },
            hookScore: { type: "number" },
            overallScore: { type: "number" },
            rationale: { type: "string" },
            rewrites: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: { type: "string" },
            },
          },
          required: [
            "controversyScore",
            "relevanceScore",
            "audiencePainScore",
            "clipabilityScore",
            "monetizationScore",
            "hookScore",
            "overallScore",
            "rationale",
            "rewrites",
          ],
        },
      },
    },
  });

  const parsed = JSON.parse(response.output_text) as StructuredTopicScore;
  const topicScore: TopicScore = {
    controversyScore: clampScore(parsed.controversyScore),
    relevanceScore: clampScore(parsed.relevanceScore),
    audiencePainScore: clampScore(parsed.audiencePainScore),
    clipabilityScore: clampScore(parsed.clipabilityScore),
    monetizationScore: clampScore(parsed.monetizationScore),
    hookScore: clampScore(parsed.hookScore),
    overallScore: clampScore(parsed.overallScore),
    rationale: cleanupSpokenChinese(parsed.rationale),
  };

  return {
    topicScore,
    rewrites: parsed.rewrites.map((item) => cleanupSpokenChinese(item)),
    approved: topicScore.overallScore >= 75,
  } satisfies TopicScoringResult;
}

export async function scoreTopicIdea(input: CreateEpisodeInput): Promise<TopicScoringResult> {
  const topic = normalizeTopic(input.topic, input.sourceNotes);

  if (hasOpenAIKey()) {
    try {
      return await scoreTopicWithOpenAI(input, topic);
    } catch (error) {
      console.error("OpenAI topic scoring failed, falling back to heuristic scoring.", error);
    }
  }

  return scoreTopicHeuristically(input, topic);
}

function polishStructuredDraftLocally(draft: StructuredEpisodeDraft): StructuredEpisodeDraft {
  return {
    ...draft,
    title: cleanupSpokenChinese(draft.title),
    summary: cleanupSpokenChinese(draft.summary),
    showNotes: draft.showNotes.map((note) => cleanupSpokenChinese(note)),
    cta: cleanupSpokenChinese(draft.cta),
    variants: {
      titles: draft.variants.titles.map((item) => ({
        ...item,
        text: cleanupSpokenChinese(item.text),
      })),
      hookLines: draft.variants.hookLines.map((item) => ({
        ...item,
        text: cleanupSpokenChinese(item.text),
      })),
      ctas: draft.variants.ctas.map((item) => ({
        ...item,
        text: cleanupSpokenChinese(item.text),
      })),
      socialCaptions: draft.variants.socialCaptions.map((item) => ({
        ...item,
        text: cleanupSpokenChinese(item.text),
      })),
      thumbnailTexts: draft.variants.thumbnailTexts.map((item) => ({
        ...item,
        text: cleanupSpokenChinese(item.text),
      })),
    },
    turns: polishTurnsLocally(draft.turns),
  };
}

function attachFallbackSegments(
  turns: Array<{
    speaker: "A" | "B";
    text: string;
  }>,
): StructuredEpisodeDraft["turns"] {
  return turns.map((turn, index) => ({
    ...turn,
    segment: segmentBlueprint[Math.min(index, segmentBlueprint.length - 1)].label,
  }));
}

function clipify(text: string) {
  const cleaned = cleanupSpokenChinese(text);

  if (cleaned.length <= 38) {
    return cleaned;
  }

  return `${cleaned.slice(0, 36).replace(/[，。；：,.;:]+$/g, "")}。`;
}

function variantify(text: string, maxLength: number) {
  const cleaned = cleanupSpokenChinese(text).replace(/[。！？!?]+$/g, "");

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.slice(0, maxLength).replace(/[，。；：,.;:\s]+$/g, "");
}

function normalizeVariantText(
  text: string,
  kind: "title" | "hook" | "cta" | "caption" | "thumbnail",
) {
  const limits = {
    title: 32,
    hook: 42,
    cta: 44,
    caption: 68,
    thumbnail: 18,
  } satisfies Record<"title" | "hook" | "cta" | "caption" | "thumbnail", number>;

  const normalized = variantify(text, limits[kind]);
  return kind === "caption" ? normalized : normalized.replace(/[。！？!?]+$/g, "");
}

function normalizeVariantList(
  items: Array<{ style: EpisodeVariantStyle; text: string }>,
  kind: "title" | "hook" | "cta" | "caption" | "thumbnail",
): EpisodeTextVariant[] {
  return items.map((item, index) => ({
    id: `${kind}-${index + 1}`,
    style: item.style,
    text: normalizeVariantText(item.text, kind),
  }));
}

function hasChallengeSignal(text: string) {
  return /(但|可是|问题是|等一下|先等一下|现实一点看|真的成立吗|会不会|该不该)/.test(text);
}

function normalizeSegmentedDraft(draft: StructuredEpisodeDraft, conflictLevel: ConflictLevel) {
  const normalizedTurns = draft.turns.map((turn, index) => {
    const expectedSegment = segmentBlueprint[Math.min(index, segmentBlueprint.length - 1)].label;
    const nextTurn = {
      ...turn,
      segment: turn.segment || expectedSegment,
      text: cleanupSpokenChinese(turn.text),
    };

    if (index < segmentBlueprint.length) {
      nextTurn.segment = expectedSegment;
    }

    if (nextTurn.segment === "first_clash" || nextTurn.segment === "reality_check") {
      nextTurn.speaker = "B";
      if (!hasChallengeSignal(nextTurn.text)) {
        nextTurn.text = `但问题是，${nextTurn.text}`;
      }
    }

    if (nextTurn.segment === "clip_line" || nextTurn.segment === "final_takeaway") {
      nextTurn.speaker = "A";
    }

    if (nextTurn.segment === "clip_line") {
      nextTurn.text = clipify(nextTurn.text);
    }

    return nextTurn;
  });

  if (conflictLevel !== "low") {
    const challengeCount = normalizedTurns.filter(
      (turn) => turn.speaker === "B" && hasChallengeSignal(turn.text),
    ).length;

    if (challengeCount < 2) {
      const firstClash = normalizedTurns.find((turn) => turn.segment === "first_clash");
      const realityCheck = normalizedTurns.find((turn) => turn.segment === "reality_check");

      if (firstClash && !hasChallengeSignal(firstClash.text)) {
        firstClash.text = `先等一下，${firstClash.text}`;
      }

      if (realityCheck && !hasChallengeSignal(realityCheck.text)) {
        realityCheck.text = `现实一点看，${realityCheck.text}`;
      }
    }
  }

  const clipTargets = new Set<ScriptSegmentLabel>(["hook", "reframe", "clip_line"]);
  normalizedTurns.forEach((turn) => {
    if (clipTargets.has(turn.segment)) {
      turn.text = clipify(turn.text);
    }
  });

  return {
    ...draft,
    variants: {
      titles: normalizeVariantList(draft.variants.titles, "title"),
      hookLines: normalizeVariantList(draft.variants.hookLines, "hook"),
      ctas: normalizeVariantList(draft.variants.ctas, "cta"),
      socialCaptions: normalizeVariantList(draft.variants.socialCaptions, "caption"),
      thumbnailTexts: normalizeVariantList(draft.variants.thumbnailTexts, "thumbnail"),
    },
    turns: normalizedTurns,
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
              "- Keep the title, hook, CTA, caption, and thumbnail variants sharp and platform-ready.",
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
            variants: {
              type: "object",
              additionalProperties: false,
              properties: {
                titles: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      style: { type: "string", enum: ["aggressive", "curiosity", "authority", "emotional", "practical"] },
                      text: { type: "string" },
                    },
                    required: ["style", "text"],
                  },
                },
                hookLines: {
                  type: "array",
                  minItems: 2,
                  maxItems: 2,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      style: { type: "string", enum: ["aggressive", "curiosity", "authority", "emotional", "practical"] },
                      text: { type: "string" },
                    },
                    required: ["style", "text"],
                  },
                },
                ctas: {
                  type: "array",
                  minItems: 2,
                  maxItems: 2,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      style: { type: "string", enum: ["aggressive", "curiosity", "authority", "emotional", "practical"] },
                      text: { type: "string" },
                    },
                    required: ["style", "text"],
                  },
                },
                socialCaptions: {
                  type: "array",
                  minItems: 5,
                  maxItems: 5,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      style: { type: "string", enum: ["aggressive", "curiosity", "authority", "emotional", "practical"] },
                      text: { type: "string" },
                    },
                    required: ["style", "text"],
                  },
                },
                thumbnailTexts: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      style: { type: "string", enum: ["aggressive", "curiosity", "authority", "emotional", "practical"] },
                      text: { type: "string" },
                    },
                    required: ["style", "text"],
                  },
                },
              },
              required: ["titles", "hookLines", "ctas", "socialCaptions", "thumbnailTexts"],
            },
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
                  segment: {
                    type: "string",
                    enum: segmentBlueprint.map((segment) => segment.label),
                  },
                  text: {
                    type: "string",
                  },
                },
                required: ["speaker", "segment", "text"],
              },
            },
          },
          required: ["title", "summary", "showNotes", "cta", "variants", "turns"],
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

function buildEpisodeVariants(topic: string, summary: string, cta: string): EpisodeVariantBundle {
  return {
    titles: normalizeVariantList(
      [
        { style: "aggressive", text: `别再把“${topic}”讲成废话了` },
        { style: "curiosity", text: `为什么“${topic}”越多人做，越少人讲明白？` },
        { style: "authority", text: `关于“${topic}”，一套更能留住听众的讲法` },
      ],
      "title",
    ),
    hookLines: normalizeVariantList(
      [
        { style: "aggressive", text: `很多人以为“${topic}”的问题在工具，其实问题根本不在这。` },
        { style: "curiosity", text: `如果“${topic}”真的有用，为什么大多数人做了还是没结果？` },
      ],
      "hook",
    ),
    ctas: normalizeVariantList(
      [
        { style: "practical", text: cta },
        { style: "authority", text: `想把“${topic}”做成稳定栏目，先从固定结构和固定主持关系开始。` },
      ],
      "cta",
    ),
    socialCaptions: normalizeVariantList(
      [
        { style: "aggressive", text: `别把“${topic}”做成一堆顺滑废话，这集直接讲清楚问题到底卡在哪。` },
        { style: "curiosity", text: `为什么看起来都在聊“${topic}”，真正能让人听完的内容却不多？` },
        { style: "authority", text: `${summary} 这集给你一套更像节目、也更像内容产品的讲法。` },
        { style: "emotional", text: `如果你也一直在“${topic}”上卡住，这集会帮你把焦虑拆成可执行的几步。` },
        { style: "practical", text: `从选题、结构到主持分工，这集把“${topic}”怎么讲更容易留住听众一次讲透。` },
      ],
      "caption",
    ),
    thumbnailTexts: normalizeVariantList(
      [
        { style: "aggressive", text: `别再空聊${topic}` },
        { style: "curiosity", text: `${topic}真问题` },
        { style: "practical", text: `${topic}怎么讲` },
      ],
      "thumbnail",
    ),
  };
}

function buildEpisodeAnalytics(
  input: CreateEpisodeInput,
  hostA: VoiceProfile,
  hostB: VoiceProfile,
  script: ScriptTurn[],
): EpisodeAnalytics {
  return {
    hostPair: `${hostA.name} + ${hostB.name}`,
    conflictLevel: input.conflictLevel ?? "medium",
    templateType: input.template,
    numberOfClipLines: script.filter((turn) => turn.segment === "clip_line").length,
    metrics: {
      impressions: 0,
      clicks: 0,
      listens: 0,
      completionRate: 0,
      saves: 0,
      shares: 0,
    },
  };
}

function inferClipTags(segment: ScriptSegmentLabel, text: string): EpisodeClipTag[] {
  const tags = new Set<EpisodeClipTag>();

  if (segment === "first_clash" || segment === "reality_check") {
    tags.add("debate");
  }

  if (segment === "reframe" || segment === "final_takeaway" || segment === "clip_line") {
    tags.add("insight");
  }

  if (/(但|问题是|真相|误区|等一下|会不会|该不该)/.test(text)) {
    tags.add("controversial");
  }

  if (/(现实|执行|赚钱|变现|成本|用户|市场)/.test(text)) {
    tags.add("practical");
  }

  if (/(害怕|焦虑|卡住|没结果|留不住|没人)/.test(text)) {
    tags.add("emotional");
  }

  if (tags.size === 0) {
    tags.add("insight");
  }

  return Array.from(tags).slice(0, 3);
}

function buildClipTitle(segment: ScriptSegmentLabel, text: string) {
  const clean = clipify(text).replace(/[。！？!?]+$/g, "");

  switch (segment) {
    case "hook":
      return `开场钩子：${clean}`;
    case "first_clash":
      return `第一次拉扯：${clean}`;
    case "reality_check":
      return `现实打脸：${clean}`;
    case "concrete_example":
      return `具体例子：${clean}`;
    case "reframe":
      return `观点翻转：${clean}`;
    case "final_takeaway":
      return `最终 takeaway：${clean}`;
    case "clip_line":
      return `收尾金句：${clean}`;
    case "setup":
    default:
      return `选题切口：${clean}`;
  }
}

function buildClipCaption(text: string, tags: EpisodeClipTag[]) {
  return `${clipify(text)} #${tags.slice(0, 2).join(" #")}`;
}

function extractEpisodeClips(script: ScriptTurn[]): EpisodeClip[] {
  const preferredSegments: ScriptSegmentLabel[] = [
    "hook",
    "first_clash",
    "reality_check",
    "concrete_example",
    "reframe",
    "final_takeaway",
    "clip_line",
  ];

  return preferredSegments
    .map((segment, index) => {
      const turn = script.find((item) => item.segment === segment);

      if (!turn) {
        return undefined;
      }

      const tags = inferClipTags(segment, turn.text);

      return {
        id: `clip-${index + 1}`,
        clipTitle: buildClipTitle(segment, turn.text),
        hookLine: clipify(turn.text),
        startSegment: segment,
        endSegment: segment,
        whyItWorks:
          segment === "first_clash" || segment === "reality_check"
            ? "这段有明确分歧，最容易在短视频里制造停留。"
            : segment === "clip_line"
              ? "这句足够短，适合直接做结尾切条。"
              : "这段信息密度高，而且能单独成立，适合切成短内容。",
        shortCaption: buildClipCaption(turn.text, tags),
        tags,
      } satisfies EpisodeClip;
    })
    .filter((clip): clip is EpisodeClip => Boolean(clip))
    .slice(0, 7);
}

function buildEpisodeFromTurns(
  input: CreateEpisodeInput,
  hostA: VoiceProfile,
  hostB: VoiceProfile,
  topic: string,
  script: ScriptTurn[],
  generationMode: Episode["generationMode"],
  topicScore?: TopicScore,
  topicRewrites?: string[],
  title?: string,
  summary?: string,
  showNotes?: string[],
  cta?: string,
  variants?: EpisodeVariantBundle,
): Episode {
  const resolvedSummary = summary || buildShowAwareSummary(input, topic, input.sourceNotes);
  const resolvedCta = cta || buildShowAwareCta(input, topic);

  return {
    id: makeEpisodeId(),
    title: title || buildTitle(topic, input.template),
    showName: input.showName.trim() || "Untitled Show",
    summary: resolvedSummary,
    showNotes: showNotes || buildShowNotes(topic, input.sourceNotes),
    cta: resolvedCta,
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
    topicScore,
    topicRewrites,
    clips: extractEpisodeClips(script),
    variants: variants || buildEpisodeVariants(topic, resolvedSummary, resolvedCta),
    analytics: buildEpisodeAnalytics(input, hostA, hostB, script),
    appliedRecommendation:
      input.recommendationId && input.recommendationTitle
        ? {
            id: input.recommendationId,
            title: input.recommendationTitle,
            appliedAt: new Date().toISOString(),
          }
        : undefined,
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
              "- Use exactly these segment labels in order: hook, setup, first_clash, reality_check, concrete_example, reframe, final_takeaway, clip_line.",
              "- Each segment should have 1 or 2 turns only.",
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
              "- Every 4 to 6 lines must include one challenge or disagreement.",
              "- Host B must interrupt at least twice in medium or high conflict mode.",
              "- At least 3 lines should feel short and clip-worthy.",
              "- Write spoken Chinese, not essay Chinese. Avoid polished article transitions.",
              "- Vary sentence length. Mix short interruptions with medium explanation lines.",
              "- At least one turn should feel like a natural interruption or sharp follow-up.",
              `- Pair dynamics: ${pairDynamics.dynamics}`,
              `- Pacing rule: ${pairDynamics.pacing}`,
              "- Provide 3 concise show notes bullets and 1 short CTA for the episode description.",
              "- Also return distribution variants.",
              "- Return exactly 3 title variants.",
              "- Return exactly 2 intro hook variants.",
              "- Return exactly 2 CTA variants.",
              "- Return exactly 5 social caption variants.",
              "- Return exactly 3 thumbnail text options.",
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
            variants: {
              type: "object",
              additionalProperties: false,
              properties: {
                titles: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      style: { type: "string", enum: ["aggressive", "curiosity", "authority", "emotional", "practical"] },
                      text: { type: "string" },
                    },
                    required: ["style", "text"],
                  },
                },
                hookLines: {
                  type: "array",
                  minItems: 2,
                  maxItems: 2,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      style: { type: "string", enum: ["aggressive", "curiosity", "authority", "emotional", "practical"] },
                      text: { type: "string" },
                    },
                    required: ["style", "text"],
                  },
                },
                ctas: {
                  type: "array",
                  minItems: 2,
                  maxItems: 2,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      style: { type: "string", enum: ["aggressive", "curiosity", "authority", "emotional", "practical"] },
                      text: { type: "string" },
                    },
                    required: ["style", "text"],
                  },
                },
                socialCaptions: {
                  type: "array",
                  minItems: 5,
                  maxItems: 5,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      style: { type: "string", enum: ["aggressive", "curiosity", "authority", "emotional", "practical"] },
                      text: { type: "string" },
                    },
                    required: ["style", "text"],
                  },
                },
                thumbnailTexts: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      style: { type: "string", enum: ["aggressive", "curiosity", "authority", "emotional", "practical"] },
                      text: { type: "string" },
                    },
                    required: ["style", "text"],
                  },
                },
              },
              required: ["titles", "hookLines", "ctas", "socialCaptions", "thumbnailTexts"],
            },
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
                    segment: {
                      type: "string",
                      enum: segmentBlueprint.map((segment) => segment.label),
                    },
                    text: {
                      type: "string",
                    },
                  },
                  required: ["speaker", "segment", "text"],
                },
              },
          },
          required: ["title", "summary", "showNotes", "cta", "variants", "turns"],
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
  const topicScoring =
    input.approvedTopicScore
      ? {
          topicScore: input.approvedTopicScore,
          rewrites: input.approvedTopicRewrites ?? [],
          approved: input.approvedTopicScore.overallScore >= 75,
        }
      : await scoreTopicIdea(input);

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
      const normalizedDraft = normalizeSegmentedDraft(polished, conflictLevel);
      const script = normalizedDraft.turns.map((turn, index) => ({
        ...makeTurn(index + 1, turn.speaker, turn.text.trim()),
        segment: turn.segment,
      }));

      return buildEpisodeFromTurns(
        input,
        hostA,
        hostB,
        topic,
        script,
        "openai",
        topicScoring.topicScore,
        topicScoring.rewrites,
        normalizedDraft.title.trim(),
        normalizedDraft.summary.trim(),
        normalizedDraft.showNotes.map((note) => note.trim()),
        normalizedDraft.cta.trim(),
        normalizedDraft.variants,
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
    variants: buildEpisodeVariants(
      topic,
      buildSummary(topic, input.sourceNotes),
      buildCta(topic),
    ),
    turns: attachFallbackSegments(buildScript(
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
    }))),
  } satisfies StructuredEpisodeDraft;
  const polishedFallback = normalizeSegmentedDraft(
    polishStructuredDraftLocally(fallbackDraft),
    conflictLevel,
  );
  const fallbackScript = polishedFallback.turns.map((turn, index) => ({
    ...makeTurn(index + 1, turn.speaker, turn.text),
    segment: turn.segment,
  }));

  return buildEpisodeFromTurns(
    input,
    hostA,
    hostB,
    topic,
    fallbackScript,
    "fallback",
    topicScoring.topicScore,
    topicScoring.rewrites,
    polishedFallback.title,
    polishedFallback.summary,
    polishedFallback.showNotes,
    polishedFallback.cta,
    polishedFallback.variants,
  );
}
