export const reportSchema = {
  requiredSections: ["Vue d'ensemble", "Main gauche", "Main droite", "Forces dominantes", "Axes d'évolution", "Cohérence globale", "Synthèse finale"],
  validate: (text) => {
    return reportSchema.requiredSections.every(section => text.includes(section));
  }
};
