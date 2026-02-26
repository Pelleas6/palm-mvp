const json = await response.json();

if (!response.ok) {
  setError(json?.error || "Erreur upload");
  setLoading(false);
  return;
}

// ici tu dois garder ces 2 valeurs pour l’IA
const { leftPath, rightPath } = json;

if (!leftPath || !rightPath) {
  setError("Upload OK mais paths manquants.");
  setLoading(false);
  return;
}
