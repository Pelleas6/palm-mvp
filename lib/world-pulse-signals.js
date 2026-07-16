export const WORLD_PULSE_UNCLASSIFIED_LABEL = "Non déterminé";

export const WORLD_PULSE_SIGNAL_CATEGORIES = [
  {
    id: "conflict_tension",
    label: "Conflit/tension",
    color: "#ff6f61",
    description: "Conflits armés, tensions diplomatiques, crises et violences.",
    keywords: [
      "conflict", "conflit", "tension", "war", "guerre", "military", "militaire",
      "attack", "attaque", "violence", "missile", "hostage", "otage", "crisis", "crise",
      "ceasefire", "cessez le feu", "bombardment", "invasion", "frontline",
    ],
  },
  {
    id: "politics_elections",
    label: "Politique/élections",
    color: "#83a8ff",
    description: "Vie politique, gouvernements, scrutins, campagnes et institutions.",
    keywords: [
      "politics", "politique", "government", "gouvernement", "election", "élection", "elections",
      "vote", "poll", "sondage", "campaign", "campagne", "ballot", "scrutin", "president",
      "parliament", "parlement", "minister", "ministre", "senate", "congress",
    ],
  },
  {
    id: "economy_markets",
    label: "Économie/marchés",
    color: "#f5bd4f",
    description: "Économie, entreprises, marchés financiers, commerce et emploi.",
    keywords: [
      "economy", "économie", "economic", "market", "marché", "markets", "stock", "stocks",
      "finance", "financial", "inflation", "recession", "growth", "croissance", "trade", "commerce",
      "tariff", "tarifs", "business", "company", "emploi", "jobs", "bank", "banque",
    ],
  },
  {
    id: "climate_environment",
    label: "Climat/environnement",
    color: "#3ed6c3",
    description: "Climat, biodiversité, pollution et politiques environnementales.",
    keywords: [
      "climate", "climat", "environment", "environnement", "biodiversity", "biodiversité",
      "pollution", "carbon", "carbone", "emission", "émission", "warming", "réchauffement",
      "greenhouse", "ecology", "écologie", "deforestation", "déforestation",
    ],
  },
  {
    id: "health",
    label: "Santé",
    color: "#8ee37d",
    description: "Santé publique, médecine, épidémies, hôpitaux et vaccins.",
    keywords: [
      "health", "santé", "disease", "maladie", "virus", "hospital", "hôpital", "vaccine",
      "vaccin", "pandemic", "pandémie", "medicine", "médecine", "doctor", "médecin",
      "epidemic", "épidémie", "patient", "pharma", "drug", "treatment", "traitement",
    ],
  },
  {
    id: "science_technology",
    label: "Science/technologie",
    color: "#65d7ff",
    description: "Recherche, innovation, numérique, IA, espace et technologies.",
    keywords: [
      "science", "scientific", "research", "recherche", "technology", "technologie", "tech",
      "artificial intelligence", "intelligence artificielle", "ai", "ia", "cyber", "software",
      "semiconductor", "chip", "numérique", "digital", "robot", "space", "espace", "satellite",
    ],
  },
  {
    id: "security_defense",
    label: "Sécurité/défense",
    color: "#d488ff",
    description: "Sécurité intérieure, défense, renseignement, police et cybermenaces.",
    keywords: [
      "security", "sécurité", "defense", "defence", "défense", "police", "terror", "terrorism",
      "terrorisme", "intelligence service", "renseignement", "cyberattack", "cyberattaque",
      "surveillance", "crime", "criminal", "army", "armée", "navy", "air force",
    ],
  },
  {
    id: "justice_society",
    label: "Justice/société",
    color: "#f28db2",
    description: "Justice, droits, mouvements sociaux, éducation, société et inégalités.",
    keywords: [
      "justice", "court", "tribunal", "trial", "procès", "law", "loi", "rights", "droits",
      "society", "société", "social", "protest", "manifestation", "strike", "grève", "education",
      "éducation", "school", "école", "migration", "migrant", "inequality", "inégalité",
    ],
  },
  {
    id: "culture_media",
    label: "Culture/médias",
    color: "#c9a84c",
    description: "Culture, arts, médias, divertissement et patrimoine.",
    keywords: [
      "culture", "media", "médias", "press", "presse", "journalism", "journalisme",
      "film", "cinema", "cinéma", "music", "musique", "artist", "artiste", "festival",
      "book", "livre", "museum", "musée", "heritage", "patrimoine", "television", "tv",
    ],
  },
  {
    id: "sport",
    label: "Sport",
    color: "#45c17e",
    description: "Compétitions, clubs, athlètes et résultats sportifs.",
    keywords: [
      "sport", "sports", "football", "soccer", "tennis", "basketball", "rugby", "olympic",
      "olympics", "olympique", "match", "tournament", "tournoi", "championship", "championnat",
      "athlete", "athlète", "race", "racing", "fifa", "uefa",
    ],
  },
  {
    id: "disasters_weather",
    label: "Catastrophes/météo",
    color: "#ff9f6e",
    description: "Catastrophes naturelles, accidents majeurs et météo extrême.",
    keywords: [
      "disaster", "catastrophe", "weather", "météo", "storm", "tempête", "hurricane", "cyclone",
      "flood", "inondation", "wildfire", "incendie", "drought", "sécheresse", "heatwave",
      "canicule", "earthquake", "séisme", "tsunami", "landslide", "accident",
    ],
  },
  {
    id: "energy_transport",
    label: "Énergie/transport",
    color: "#7bdff2",
    description: "Énergie, matières premières, infrastructures et transports.",
    keywords: [
      "energy", "énergie", "oil", "pétrole", "gas", "gaz", "electricity", "électricité",
      "nuclear", "nucléaire", "renewable", "renouvelable", "transport", "rail", "train",
      "aviation", "airline", "shipping", "maritime", "port", "road", "route", "infrastructure",
    ],
  },
];

export const WORLD_PULSE_UNCLASSIFIED_CATEGORY = {
  id: "unclassified",
  label: WORLD_PULSE_UNCLASSIFIED_LABEL,
  color: "#b5c7bf",
  description: "Aucun mot-clé du registre déterministe n'a été détecté ; ce regroupement reste hors taxonomie utile.",
  keywords: [],
  thematic: false,
};

export const WORLD_PULSE_QUERY_TERMS = [
  "conflict", "election", "economy", "market", "climate", "health", "science", "technology",
  "security", "justice", "culture", "sport", "disaster", "weather", "energy", "transport",
];

export const WORLD_PULSE_SIGNAL_LEGEND = [
  ...WORLD_PULSE_SIGNAL_CATEGORIES.map(({ id, label, color, description }) => ({ id, label, color, description, thematic: true })),
  {
    id: WORLD_PULSE_UNCLASSIFIED_CATEGORY.id,
    label: WORLD_PULSE_UNCLASSIFIED_CATEGORY.label,
    color: WORLD_PULSE_UNCLASSIFIED_CATEGORY.color,
    description: WORLD_PULSE_UNCLASSIFIED_CATEGORY.description,
    thematic: false,
  },
];

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
    || WORLD_PULSE_UNCLASSIFIED_CATEGORY;
}

export function isWorldPulseClassifiedLabel(label) {
  return WORLD_PULSE_SIGNAL_CATEGORIES.some((category) => category.label === label);
}

export function colorForWorldPulseSignalLabel(label) {
  return WORLD_PULSE_SIGNAL_LEGEND.find((category) => category.label === label)?.color
    || WORLD_PULSE_UNCLASSIFIED_CATEGORY.color;
}