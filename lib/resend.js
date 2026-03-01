import { Resend } from "resend";
import { getEnv } from "./env";

export function getResendClient() {
  const key = getEnv("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY manquante");
  return new Resend(key);
}
