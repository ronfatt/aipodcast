import { getOpenAIClient, getScriptModel, hasOpenAIKey } from "@/lib/openai";
import { CreateEpisodeInput, Episode, ScriptTurn, VoiceProfile } from "@/lib/types";

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

function buildScript(
  topic: string,
  sourceNotes: string,
  hostA: VoiceProfile,
  hostB: VoiceProfile,
  template: string,
): ScriptTurn[] {
  const notesSnippet =
    sourceNotes.trim().length > 0
      ? `我先抓一下输入资料里的主线，它其实在讲：${sourceNotes.trim().slice(0, 72)}。`
      : `如果把这个主题讲给第一次接触的人听，我们最先要回答的是它为什么现在值得聊。`;

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
    summary: summary || buildSummary(topic, input.sourceNotes),
    showNotes: showNotes || buildShowNotes(topic, input.sourceNotes),
    cta: cta || buildCta(topic),
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
) {
  const client = getOpenAIClient();
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
              `Topic: ${topic}`,
              `Source notes: ${input.sourceNotes || "No extra notes provided."}`,
              `Template: ${input.template}`,
              `Host A name: ${hostA.name}`,
              `Host A persona: ${hostA.persona}; style: ${hostA.style}`,
              `Host B name: ${hostB.name}`,
              `Host B persona: ${hostB.persona}; style: ${hostB.style}`,
              "Goal: create a 6-12 minute episode with clear pacing and listener-friendly flow.",
              "Constraints:",
              "- Return 8 to 12 dialogue turns.",
              "- Alternate speakers naturally, starting with A.",
              "- End with Host A delivering the final takeaway in one concise closing turn.",
              "- Host A explains and drives the story.",
              "- Host B questions, reframes, and summarizes.",
              "- Include at least one challenge, one concrete example, and one closing takeaway.",
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
): Promise<Episode> {
  const topic = normalizeTopic(input.topic, input.sourceNotes);

  if (hasOpenAIKey()) {
    try {
      const structured = await generateStructuredScript(input, hostA, hostB, topic);
      const script = structured.turns.map((turn, index) =>
        makeTurn(index + 1, turn.speaker, turn.text.trim()),
      );

      return buildEpisodeFromTurns(
        input,
        hostA,
        hostB,
        topic,
        script,
        "openai",
        structured.title.trim(),
        structured.summary.trim(),
        structured.showNotes.map((note) => note.trim()),
        structured.cta.trim(),
      );
    } catch (error) {
      console.error("OpenAI script generation failed, falling back to local generator.", error);
    }
  }

  const fallbackScript = buildScript(topic, input.sourceNotes, hostA, hostB, input.template);

  return buildEpisodeFromTurns(input, hostA, hostB, topic, fallbackScript, "fallback");
}
