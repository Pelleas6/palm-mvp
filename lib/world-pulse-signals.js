export const WORLD_PULSE_UNCLASSIFIED_LABEL = "Non déterminé";

export const WORLD_PULSE_SIGNAL_CATEGORIES = [
  {
    id: "conflict_tension",
    label: "Conflit/tension",
    color: "#d77a72",
    description: "Conflits armés, tensions diplomatiques, crises et violences.",
    keywords: [
      "conflict", "conflit", "tension", "war", "guerre", "military", "militaire",
      "attack", "attaque", "violence", "missile", "hostage", "otage", "crisis", "crise",
      "ceasefire", "cessez le feu", "bombardment", "invasion", "frontline", "airstrike",
      "drone", "shelling", "troops", "armed", "guerra", "ataque", "konflik", "perang", "serangan", "pertempuran",
    ],
  },
  {
    id: "politics_elections",
    label: "Politique/élections",
    color: "#7f9bd0",
    description: "Vie politique, gouvernements, scrutins, campagnes et institutions.",
    keywords: [
      "politics", "politique", "government", "gouvernement", "election", "élection", "elections",
      "vote", "poll", "sondage", "campaign", "campagne", "ballot", "scrutin", "president",
      "parliament", "parlement", "minister", "ministre", "senate", "congress", "prime minister",
      "cabinet", "opposition", "political party", "mayor", "governor", "presiden", "pemerintah", "pemilu", "menteri",
      "gobierno", "elecciones", "presidente", "governo", "eleicao", "eleição",
    ],
  },
  {
    id: "economy_markets",
    label: "Économie/marchés",
    color: "#c59a59",
    description: "Économie, entreprises, marchés financiers, commerce et emploi.",
    keywords: [
      "economy", "économie", "economic", "market", "marché", "markets", "stock", "stocks",
      "finance", "financial", "inflation", "recession", "growth", "croissance", "trade", "commerce",
      "tariff", "tarifs", "business", "company", "emploi", "jobs", "bank", "banque", "revenue", "profit",
      "earnings", "investor", "investment", "startup", "merger", "acquisition", "economia", "economía", "mercado", "mercados",
      "bisnis", "ekonomi", "pasar", "investasi", "perusahaan",
    ],
  },
  {
    id: "climate_environment",
    label: "Climat/environnement",
    color: "#55a99f",
    description: "Climat, biodiversité, pollution et politiques environnementales.",
    keywords: [
      "climate", "climat", "environment", "environnement", "biodiversity", "biodiversité",
      "pollution", "carbon", "carbone", "emission", "émission", "warming", "réchauffement",
      "greenhouse", "ecology", "écologie", "deforestation", "déforestation", "conservation", "wildlife",
      "sustainability", "sustainable", "lingkungan", "iklim", "hutan", "ambiental", "ambiental",
    ],
  },
  {
    id: "health",
    label: "Santé",
    color: "#76aa7d",
    description: "Santé publique, médecine, épidémies, hôpitaux et vaccins.",
    keywords: [
      "health", "santé", "disease", "maladie", "virus", "hospital", "hôpital", "vaccine",
      "vaccin", "pandemic", "pandémie", "medicine", "médecine", "doctor", "médecin",
      "epidemic", "épidémie", "patient", "pharma", "drug", "treatment", "traitement", "healthcare",
      "clinic", "outbreak", "covid", "dengue", "mental health", "kesehatan", "rumah sakit", "salud", "saude",
    ],
  },
  {
    id: "science_technology",
    label: "Science/technologie",
    color: "#639db5",
    description: "Recherche, innovation, numérique, IA, espace et technologies.",
    keywords: [
      "science", "scientific", "research", "recherche", "technology", "technologie", "tech",
      "artificial intelligence", "intelligence artificielle", "ai", "ia", "cyber", "software",
      "semiconductor", "chip", "numérique", "digital", "robot", "space", "espace", "satellite", "internet",
      "online", "platform", "app", "application", "data", "mobile", "innovation", "teknologi", "digitalisasi",
    ],
  },
  {
    id: "security_defense",
    label: "Sécurité/défense",
    color: "#9a7fba",
    description: "Sécurité intérieure, défense, renseignement, police et cybermenaces.",
    keywords: [
      "security", "sécurité", "defense", "defence", "défense", "police", "terror", "terrorism",
      "terrorisme", "intelligence service", "renseignement", "cyberattack", "cyberattaque",
      "surveillance", "crime", "criminal", "army", "armée", "navy", "air force", "border security",
      "military base", "sabotage", "trafficking", "polisi", "keamanan", "pertahanan",
    ],
  },
  {
    id: "justice_society",
    label: "Justice/société",
    color: "#c47d98",
    description: "Justice, droits, mouvements sociaux, éducation, société et inégalités.",
    keywords: [
      "justice", "court", "tribunal", "trial", "procès", "law", "loi", "rights", "droits",
      "society", "société", "social", "protest", "manifestation", "strike", "grève", "education",
      "éducation", "school", "école", "migration", "migrant", "inequality", "inégalité", "lawyer", "lawyers",
      "judge", "judges", "legal", "ruling", "verdict", "arrest", "arrested", "detained", "human rights",
      "committee", "housing", "pengadilan", "hak asasi", "abogado", "juez",
    ],
  },
  {
    id: "culture_media",
    label: "Culture/médias",
    color: "#a78b5b",
    description: "Culture, arts, médias, divertissement et patrimoine.",
    keywords: [
      "culture", "media", "médias", "press", "presse", "journalism", "journalisme",
      "film", "cinema", "cinéma", "music", "musique", "artist", "artiste", "festival",
      "book", "livre", "museum", "musée", "heritage", "patrimoine", "television", "tv", "theatre",
      "theater", "show", "series", "celebrity", "entertainment", "broadcast", "concert", "seni", "budaya",
    ],
  },
  {
    id: "sport",
    label: "Sport",
    color: "#5ea681",
    description: "Compétitions, clubs, athlètes et résultats sportifs.",
    keywords: [
      "sport", "sports", "football", "soccer", "tennis", "basketball", "rugby", "olympic",
      "olympics", "olympique", "match", "tournament", "tournoi", "championship", "championnat",
      "athlete", "athlète", "race", "racing", "fifa", "uefa", "club", "league", "goal", "coach", "player",
      "athletics", "atlet", "efootball", "esports", "cricket", "badminton", "volleyball", "liga", "pertandingan", "sepak",
    ],
  },
  {
    id: "disasters_weather",
    label: "Catastrophes/météo",
    color: "#c4876e",
    description: "Catastrophes naturelles, accidents majeurs et météo extrême.",
    keywords: [
      "disaster", "catastrophe", "weather", "météo", "storm", "tempête", "hurricane", "cyclone",
      "flood", "inondation", "wildfire", "incendie", "drought", "sécheresse", "heatwave",
      "canicule", "earthquake", "séisme", "tsunami", "landslide", "accident", "flooding", "heavy rain",
      "rainfall", "landslide", "bencana", "banjir", "gempa", "cuaca", "tormenta", "inundacion",
    ],
  },
  {
    id: "energy_transport",
    label: "Énergie/transport",
    color: "#69a7af",
    description: "Énergie, matières premières, infrastructures et transports.",
    keywords: [
      "energy", "énergie", "oil", "pétrole", "gas", "gaz", "electricity", "électricité",
      "nuclear", "nucléaire", "renewable", "renouvelable", "transport", "rail", "train",
      "aviation", "airline", "shipping", "maritime", "port", "road", "route", "infrastructure", "flight",
      "airport", "vehicle", "electric vehicle", "fuel", "solar", "wind power", "energi", "minyak", "penerbangan",
    ],
  },
];

export const WORLD_PULSE_UNCLASSIFIED_CATEGORY = {
  id: "unclassified",
  label: WORLD_PULSE_UNCLASSIFIED_LABEL,
  color: "#aab9b5",
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
  const keywordPattern = escapeRegExp(normalizedKeyword).replace(/\s+/g, "\\s+");
  return new RegExp(`(^|\\s)${keywordPattern}(?=\\s|$)`).test(text);
}

export function findWorldPulseSignalCategory(...parts) {
  const text = normalizeSignalText(parts.join(" "));
  const candidates = WORLD_PULSE_SIGNAL_CATEGORIES
    .map((category, index) => {
      const matches = [...new Set(category.keywords.filter((keyword) => hasSignalKeyword(text, keyword)))];
      const score = matches.reduce((total, keyword) => total + (normalizeSignalText(keyword).includes(" ") ? 3 : 1), 0);
      return { category, index, matches, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || right.matches.length - left.matches.length || left.index - right.index);
  const winner = candidates[0];
  if (!winner) return { ...WORLD_PULSE_UNCLASSIFIED_CATEGORY, matches: [], score: 0 };
  return { ...winner.category, matches: winner.matches, score: winner.score };
}

export function isWorldPulseClassifiedLabel(label) {
  return WORLD_PULSE_SIGNAL_CATEGORIES.some((category) => category.label === label);
}

export function colorForWorldPulseSignalLabel(label) {
  return WORLD_PULSE_SIGNAL_LEGEND.find((category) => category.label === label)?.color
    || WORLD_PULSE_UNCLASSIFIED_CATEGORY.color;
}
