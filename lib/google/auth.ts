import { JWT } from "google-auth-library";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar.readonly",
];

let client: JWT | undefined;

/**
 * Builds the service-account client from the base64-encoded JSON key.
 * Error messages never include any part of the key.
 */
function createClient(keyB64: string): JWT {
  let key: { client_email?: unknown; private_key?: unknown };
  try {
    key = JSON.parse(Buffer.from(keyB64, "base64").toString("utf8"));
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY_B64 is not a base64-encoded JSON key file",
    );
  }
  if (typeof key.client_email !== "string" || typeof key.private_key !== "string") {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY_B64 is missing client_email or private_key",
    );
  }
  return new JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES });
}

/** An OAuth access token for the service account; cached and refreshed by the client. */
export async function getAccessToken(): Promise<string> {
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (!keyB64) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_B64 is not set");
  client ??= createClient(keyB64);
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Google did not return an access token");
  return token;
}
