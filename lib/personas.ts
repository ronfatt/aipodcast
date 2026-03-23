import { ConflictLevel, HostRole, PersonaMode, VoiceProfile } from "@/lib/types";

export const personaModePresets: Array<{
  id: Exclude<PersonaMode, "custom">;
  name: string;
  description: string;
  hostAId: string;
  hostBId: string;
}> = [
  {
    id: "reality-mode",
    name: "Reality Mode",
    description: "Strategist + Challenger. Higher tension, sharper pushback, stronger listener hooks.",
    hostAId: "host-lin",
    hostBId: "host-jay",
  },
  {
    id: "insight-mode",
    name: "Insight Mode",
    description: "Strategist + Synthesizer. More reflective, cleaner structure, stronger closing takeaways.",
    hostAId: "host-lin",
    hostBId: "host-ren",
  },
];

export function roleLabel(role: HostRole) {
  switch (role) {
    case "strategist":
      return "Strategist";
    case "challenger":
      return "Challenger";
    case "observer":
      return "Observer";
    case "synthesizer":
      return "Synthesizer";
  }
}

export function inferPersonaMode(hostA: VoiceProfile, hostB: VoiceProfile): PersonaMode {
  const preset = personaModePresets.find(
    (item) => item.hostAId === hostA.id && item.hostBId === hostB.id,
  );

  return preset?.id ?? "custom";
}

export function personaModeLabel(mode: PersonaMode) {
  if (mode === "reality-mode") {
    return "Reality Mode";
  }

  if (mode === "insight-mode") {
    return "Insight Mode";
  }

  return "Custom Pairing";
}

export function conflictLevelLabel(level: ConflictLevel) {
  if (level === "low") {
    return "Low Conflict";
  }

  if (level === "high") {
    return "High Conflict";
  }

  return "Medium Conflict";
}

export function buildPairDynamics(
  hostA: VoiceProfile,
  hostB: VoiceProfile,
  conflictLevel: ConflictLevel = "medium",
) {
  const mode = inferPersonaMode(hostA, hostB);

  if (mode === "reality-mode") {
    const dynamicsByLevel = {
      low:
        "Host B should gently pressure-test Host A, add practical listener doubts, and keep the tension constructive instead of confrontational.",
      medium:
        "Host B should challenge Host A every 2-3 turns, question rosy assumptions, and force the discussion back to real creator constraints.",
      high:
        "Host B should push hard on weak logic, interrupt occasionally, and force Host A to defend the point with concrete real-world tradeoffs.",
    } satisfies Record<ConflictLevel, string>;

    const pacingByLevel = {
      low:
        "Keep the rhythm brisk but balanced. Host B should question with tact and avoid sounding combative.",
      medium:
        "Keep a brisk rhythm. Host A can use medium-length explanations, but Host B should answer with short, punchy interruptions or skeptical follow-ups.",
      high:
        "Keep the rhythm sharp. Host B should use shorter, punchier lines and at least one hard interruption, while still staying credible and not rude.",
    } satisfies Record<ConflictLevel, string>;

    return {
      mode,
      conflictLevel,
      dynamics: dynamicsByLevel[conflictLevel],
      pacing: pacingByLevel[conflictLevel],
    };
  }

  if (mode === "insight-mode") {
    const pacingByLevel = {
      low:
        "Keep the conversation calm and thoughtful. Use very light tension and smooth handoffs.",
      medium:
        "Keep the rhythm clean and thoughtful. Use fewer interruptions, more reframing, and a strong final closing insight from Host A.",
      high:
        "Keep the rhythm thoughtful but alive. Even in insight mode, allow Host B to challenge vague statements and demand sharper meaning.",
    } satisfies Record<ConflictLevel, string>;

    return {
      mode,
      conflictLevel,
      dynamics:
        "Host B should compress ideas, elevate meaning, and help land one memorable takeaway instead of escalating conflict.",
      pacing: pacingByLevel[conflictLevel],
    };
  }

  return {
    mode,
    conflictLevel,
    dynamics:
      "The hosts should not paraphrase each other. Every turn must either clarify, challenge, provide an example, or sharpen the takeaway.",
    pacing:
      "Vary sentence length and keep the conversation spoken, not essay-like. Insert at least one natural interruption or redirect.",
  };
}
