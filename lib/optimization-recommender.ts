import { Episode, OptimizationRecommendation } from "@/lib/types";

function buildPrefillHref(
  episode: Episode,
  overrides?: {
    recommendationId?: string;
    recommendationTitle?: string;
    topic?: string;
    sourceNotesPrefix?: string;
    conflictLevel?: string;
    personaMode?: string;
    template?: string;
  },
) {
  const params = new URLSearchParams();
  params.set("showId", episode.showId ?? "");
  params.set("showName", episode.showName);
  params.set("topic", overrides?.topic ?? episode.sourceContent);
  params.set(
    "sourceNotes",
    [overrides?.sourceNotesPrefix, episode.sourceContent].filter(Boolean).join("\n\n"),
  );
  params.set("template", overrides?.template ?? episode.template);
  params.set("hostAId", episode.hostA.id);
  params.set("hostBId", episode.hostB.id);
  params.set("personaMode", overrides?.personaMode ?? "reality-mode");
  params.set("conflictLevel", overrides?.conflictLevel ?? episode.analytics?.conflictLevel ?? "medium");
  if (overrides?.recommendationId) {
    params.set("recommendationId", overrides.recommendationId);
  }
  if (overrides?.recommendationTitle) {
    params.set("recommendationTitle", overrides.recommendationTitle);
  }

  return `/episodes/new?${params.toString()}`;
}

function pushRecommendation(
  list: OptimizationRecommendation[],
  recommendation: OptimizationRecommendation,
) {
  if (list.some((item) => item.id === recommendation.id)) {
    return;
  }

  list.push(recommendation);
}

export function buildEpisodeRecommendations(episode: Episode): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  const topicScore = episode.topicScore;
  const analytics = episode.analytics;
  const metrics = analytics?.metrics;
  const clipCount = episode.clips?.length ?? 0;
  const hookTurns = episode.script.filter((turn) => turn.segment === "hook");
  const firstClashTurns = episode.script.filter((turn) => turn.segment === "first_clash");
  const setupTurns = episode.script.filter((turn) => turn.segment === "setup");

  if (topicScore && topicScore.hookScore < 75) {
    pushRecommendation(recommendations, {
      id: "stronger-hook",
      title: "Stronger hook",
      rationale: "当前 hook 分不高，说明开头还不够狠，容易在前 15 秒丢人。",
      action: "把开头改成一个更尖锐的问题、误区，或一个会让听众立刻站队的判断。",
      priority: "high",
      actionLabel: "Use in next brief",
      actionHref: buildPrefillHref(episode, {
        recommendationId: "stronger-hook",
        recommendationTitle: "Stronger hook",
        topic:
          episode.topicRewrites?.[0] ??
          `为什么大多数人把“${episode.sourceContent}”讲得不够狠？`,
        sourceNotesPrefix: "优化目标：把 hook 写得更尖锐，前 15 秒必须让听众立刻想继续听。",
      }),
    });
  }

  if (topicScore && topicScore.controversyScore < 70) {
    pushRecommendation(recommendations, {
      id: "more-conflict",
      title: "More conflict",
      rationale: "选题争议度偏弱，节目容易顺滑但不炸。",
      action: "把 topic 改成“为什么大多数人做错了”“这件事到底值不值得做”这种更有立场的问法。",
      priority: "high",
      actionLabel: "Use in next brief",
      actionHref: buildPrefillHref(episode, {
        recommendationId: "more-conflict",
        recommendationTitle: "More conflict",
        topic:
          episode.topicRewrites?.[1] ??
          `为什么大多数人做“${episode.sourceContent}”时，真正做错的不是工具？`,
        conflictLevel: "high",
      }),
    });
  }

  if ((analytics?.conflictLevel === "low" || analytics?.conflictLevel === "medium") && firstClashTurns.length < 1) {
    pushRecommendation(recommendations, {
      id: "explicit-clash",
      title: "Earlier clash",
      rationale: "脚本里第一轮拉扯不够明显，节目张力会偏平。",
      action: "让 Host B 在前 4-6 句里更早打断，直接质疑 Host A 的核心判断。",
      priority: "high",
      actionLabel: "Use in next brief",
      actionHref: buildPrefillHref(episode, {
        recommendationId: "explicit-clash",
        recommendationTitle: "Earlier clash",
        conflictLevel: "high",
        personaMode: "reality-mode",
        sourceNotesPrefix: "优化目标：Host B 必须在前 4-6 句里更早打断，并明确质疑 Host A 的核心判断。",
      }),
    });
  }

  if (setupTurns.length > 1 || episode.script.length >= 10) {
    pushRecommendation(recommendations, {
      id: "shorter-setup",
      title: "Shorter setup",
      rationale: "铺垫偏长会拖慢节奏，尤其在资讯和观点类节目里很伤留存。",
      action: "压缩 setup，把背景交代控制在一个转折前完成，更快进入 clash 或 reality check。",
      priority: "medium",
      actionLabel: "Use in next brief",
      actionHref: buildPrefillHref(episode, {
        recommendationId: "shorter-setup",
        recommendationTitle: "Shorter setup",
        sourceNotesPrefix: "优化目标：缩短 setup，尽快进入 clash 或 reality check，避免背景交代过长。",
      }),
    });
  }

  if (clipCount < 5) {
    pushRecommendation(recommendations, {
      id: "more-clip-lines",
      title: "More clip lines",
      rationale: "可切条片段偏少，短内容分发空间会不够。",
      action: "在 hook、reframe、clip line 这几个段落里多写短句和可单独成立的判断。",
      priority: "medium",
      actionLabel: "Use in next brief",
      actionHref: buildPrefillHref(episode, {
        recommendationId: "more-clip-lines",
        recommendationTitle: "More clip lines",
        sourceNotesPrefix: "优化目标：至少产出 5 条可切条句子，重点强化 hook、reframe、clip line 的短句密度。",
      }),
    });
  }

  if (metrics && metrics.completionRate > 0 && metrics.completionRate < 45) {
    pushRecommendation(recommendations, {
      id: "completion-rate",
      title: "Improve completion",
      rationale: "完播率偏低，说明中段可能信息密度不足或节奏塌了。",
      action: "增加具体例子和现实打脸段落，减少解释型句子，尽量每 4-6 句就有一个转折。",
      priority: "high",
      actionLabel: "Use in next brief",
      actionHref: buildPrefillHref(episode, {
        recommendationId: "completion-rate",
        recommendationTitle: "Improve completion",
        sourceNotesPrefix: "优化目标：增加具体例子和 reality check，减少解释型句子，每 4-6 句必须有转折。",
      }),
    });
  }

  if (metrics && metrics.impressions > 0 && metrics.clicks / Math.max(metrics.impressions, 1) < 0.03) {
    pushRecommendation(recommendations, {
      id: "title-style",
      title: "Test a sharper title style",
      rationale: "CTR 偏低，通常不是内容本身，而是标题和开场包装不够强。",
      action: "优先测试 `aggressive` 或 `curiosity` 风格标题，并同步换一版更强的 hook。",
      priority: "high",
      actionLabel: "Use in next brief",
      actionHref: buildPrefillHref(episode, {
        recommendationId: "title-style",
        recommendationTitle: "Test a sharper title style",
        sourceNotesPrefix: "优化目标：优先测试 aggressive 或 curiosity 风格标题，并同步加强 hook。",
      }),
    });
  }

  if (metrics && metrics.shares > 0 && metrics.bestPerformingClipId) {
    pushRecommendation(recommendations, {
      id: "double-down-best-clip",
      title: "Double down on winning clip angle",
      rationale: "已经出现了表现最好的 clip，说明某个切口被市场验证了。",
      action: "下一集把同类型的冲突或 insight 前置，并围绕这类 clip 再做一组标题和 caption 变体。",
      priority: "medium",
      actionLabel: "Use in next brief",
      actionHref: buildPrefillHref(episode, {
        recommendationId: "double-down-best-clip",
        recommendationTitle: "Double down on winning clip angle",
        sourceNotesPrefix: `优化目标：放大最强 clip 的角度（${metrics.bestPerformingClipId}），把同类冲突或 insight 前置。`,
      }),
    });
  }

  if (!recommendations.length) {
    pushRecommendation(recommendations, {
      id: "keep-testing",
      title: "Keep testing variations",
      rationale: "当前没有明显短板，说明基础结构已经比较稳。",
      action: "继续记录平台、title style 和 best clip，优先做小范围 A/B 测试来放大优势。",
      priority: "low",
    });
  }

  return recommendations.slice(0, 6);
}

export function buildWorkspaceRecommendations(episodes: Episode[]): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  const withAnalytics = episodes.filter((episode) => episode.analytics);

  if (!withAnalytics.length) {
    return [
      {
        id: "log-more-data",
        title: "Log more performance data",
        rationale: "现在还没有足够多的表现数据，系统很难判断什么真的在赢。",
        action: "先给最近几集补上 impressions、clicks、listens、completion rate 和 best-performing clip。",
        priority: "high",
      },
    ];
  }

  const avgCompletion =
    withAnalytics.reduce((sum, episode) => sum + (episode.analytics?.metrics.completionRate ?? 0), 0) /
    withAnalytics.length;
  const avgClipCount =
    episodes.reduce((sum, episode) => sum + (episode.clips?.length ?? 0), 0) /
    Math.max(episodes.length, 1);
  const topicScores = episodes.map((episode) => episode.topicScore?.overallScore ?? 0).filter(Boolean);
  const avgTopicScore =
    topicScores.reduce((sum, value) => sum + value, 0) / Math.max(topicScores.length, 1);

  if (avgTopicScore < 78) {
    pushRecommendation(recommendations, {
      id: "raise-topic-floor",
      title: "Raise the topic score floor",
      rationale: "平均选题分还不够高，说明内容上限常常在脚本之前就被锁死了。",
      action: "把低于 80 分的题先重写再生成，优先提高争议度、痛点感和 hook 强度。",
      priority: "high",
    });
  }

  if (avgCompletion < 50) {
    pushRecommendation(recommendations, {
      id: "shorter-middle",
      title: "Tighten the middle",
      rationale: "整体完播偏低，通常说明中段解释太多、转折太少。",
      action: "缩短 setup，多做 reality check 和具体例子，把关键信息更早抛出来。",
      priority: "high",
    });
  }

  if (avgClipCount < 5) {
    pushRecommendation(recommendations, {
      id: "more-distribution-assets",
      title: "Increase clip density",
      rationale: "平均 clip 数量偏低，会限制短内容分发效率。",
      action: "强制每集至少产出 5 条 clip-worthy moments，并优先强化 hook、reframe、closing line。",
      priority: "medium",
    });
  }

  if (!recommendations.length) {
    pushRecommendation(recommendations, {
      id: "keep-learning-loop",
      title: "Keep the feedback loop running",
      rationale: "当前数据没有明显短板，更适合继续积累对比样本。",
      action: "持续记录平台和 title style，逐步找出哪种 host 组合和 conflict level 最稳。",
      priority: "low",
    });
  }

  return recommendations.slice(0, 4);
}
