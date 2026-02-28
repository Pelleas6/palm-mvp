import { Resend } from "resend";

export function getResendClient() {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    throw new Error("RESEND_API_KEY manquante");
  }

  return new Resend(key);
}
