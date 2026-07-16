export const WORLD_PULSE_SIGNAL_CATEGORIES = [
  {
    label: "Conflit/tension",
    color: "#ff6f61",
    keywords: [
      "conflict",
      "conflit",
      "tension",
      "war",
      "guerre",
      "military",
      "attack",
      "violence",
      "missile",
      "hostage",
      "crisis",
      "armée",
      "attaque",
      "otage",
    ],
  },
  {
    label: "Technologie",
    color: "#65d7ff",
    keywords: [
      "technology",
      "technologie",
      "tech",
      "artificial intelligence",
      "intelligence artificielle",
      "cyber",
      "software",
      "semiconductor",
      "chip",
      "numérique",
      "digital",
      "robot",
    ],
  },
  {
    label: "Élections",
    color: "#83a8ff",
    keywords: [
      "election",
      "élection",
      "elections",
      "vote",
      "poll",
      "campaign",
      "ballot",
      "president",
      "parliament",
      "scrutin",
      "campagne",
    ],
  },
  {
    label: "Climat",
    color: "#3ed6c3",
    keywords: [
      "climate",
      "climat",
      "weather",
      "météo",
      "carbon",
      "emission",
      "flood",
      "wildfire",
      "drought",
      "heatwave",
      "inondation",
      "sécheresse",
      "canicule",
    ],
  },
  {
    label: "Santé",
    color: "#8ee37d",
    keywords: [
      "health",
      "santé",
      "disease",
      "virus",
      "hospital",
      "vaccine",
      "pandemic",
      "medicine",
      "médecin",
      "hôpital",
      "vaccin",
    ],
  },
  {
    label: "Autre signal",
    color: "#b5c7bf",
    keywords: [],
  },
];

export const WORLD_PULSE_QUERY_TERMS = ["conflict", "technology", "election", "climate", "health"];
export const DEFAULT_WORLD_PULSE_SIGNAL_LABEL = "Autre signal";
export const WORLD_PULSE_SIGNAL_LEGEND = WORLD_PULSE_SIGNAL_CATEGORIES.map(({ label, color }) => ({ label, color }));

function normalizeSignalText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasSignalKeyword(text, keyword) {
  const normalizedKeyword = normalizeSignalText(keyword);
  if (!normalizedKeyword) return false;
  if (/^[a-z0-9]+$/.test(normalizedKeyword) && normalizedKeyword.length <= 3) {
    return new RegExp(`(^|\\s)${escapeRegExp(normalizedKeyword)}(\\s|$)`).test(text);
  }
  return text.includes(normalizedKeyword);
}

export function findWorldPulseSignalCategory(...parts) {
  const text = normalizeSignalText(parts.join(" "));
  return WORLD_PULSE_SIGNAL_CATEGORIES.find((category) => category.keywords.some((keyword) => hasSignalKeyword(text, keyword)))
    || WORLD_PULSE_SIGNAL_CATEGORIES.find((category) => category.label === DEFAULT_WORLD_PULSE_SIGNAL_LABEL);
}

export function colorForWorldPulseSignalLabel(label) {
  return WORLD_PULSE_SIGNAL_CATEGORIES.find((category) => category.label === label)?.color
    || WORLD_PULSE_SIGNAL_CATEGORIES.find((category) => category.label === DEFAULT_WORLD_PULSE_SIGNAL_LABEL)?.color
    || "#b5c7bf";
}
