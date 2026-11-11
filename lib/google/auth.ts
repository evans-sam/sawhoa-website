import { JWT } from "google-auth-library";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar.readonly",
];
const TIMEOUT_MS = 10_000;

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
  return new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
    transporterOptions: { timeout: TIMEOUT_MS },
  });
}

/** The HTTP status of a failed token request, if the error carries one. */
function statusOf(error: unknown): number | undefined {
  const e = error as { status?: unknown; response?: { status?: unknown } } | null;
  const status = e?.status ?? e?.response?.status;
  return typeof status === "number" ? status : undefined;
}

/** An OAuth access token for the service account; cached and refreshed by the client. */
export async function getAccessToken(): Promise<string> {
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (!keyB64) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_B64 is not set");
  client ??= createClient(keyB64);

  let token: string | null | undefined;
  try {
    ({ token } = await client.getAccessToken());
  } catch (error) {
    // The library's error can carry the signed assertion in its request
    // config, so only a fixed message (and the status) leaves this function.
    const status = statusOf(error);
    throw new Error(`Google token request failed${status ? ` (${status})` : ""}`);
  }
  if (!token) throw new Error("Google did not return an access token");
  return token;
}
