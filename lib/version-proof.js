function readNonEmptyEnv(env, name) {
  const value = env[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildVersionPayload(env = process.env) {
  return {
    VERCEL_GIT_COMMIT_SHA: readNonEmptyEnv(env, "VERCEL_GIT_COMMIT_SHA"),
    VERCEL_DEPLOYMENT_ID: readNonEmptyEnv(env, "VERCEL_DEPLOYMENT_ID"),
    VERCEL_DEPLOYMENT_URL:
      readNonEmptyEnv(env, "VERCEL_URL") || readNonEmptyEnv(env, "VERCEL_PROJECT_PRODUCTION_URL"),
  };
}
