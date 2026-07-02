const schema = { 
  requiredSections: ["Vue d'ensemble", "Main gauche", "Main droite", "Forces dominantes", "Axes d'évolution", "Cohérence globale", "Synthèse finale"] 
};
const report = "## Vue d'ensemble\n...\n## Main gauche\n...\n## Main droite\n...\n## Forces dominantes\n...\n## Axes d'évolution\n...\n## Cohérence globale\n...\n## Synthèse finale\n...";
console.log("Validation réussie:", schema.requiredSections.every(s => report.includes(s)));
