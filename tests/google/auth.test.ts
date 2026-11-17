import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { jwtOptions, getAccessTokenMock } = vi.hoisted(() => ({
  jwtOptions: [] as unknown[],
  getAccessTokenMock: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  JWT: class {
    constructor(options: unknown) {
      jwtOptions.push(options);
    }
    getAccessToken = getAccessTokenMock;
  },
}));

const SECRET = "signed.jwt.assertion-secret";
const KEY_B64 = Buffer.from(
  JSON.stringify({ client_email: "sa@example.iam.gserviceaccount.com", private_key: "pk" }),
).toString("base64");

async function loadAuth() {
  vi.resetModules();
  return import("@/lib/google/auth");
}

beforeEach(() => {
  jwtOptions.length = 0;
  getAccessTokenMock.mockReset();
  vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_KEY_B64", KEY_B64);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAccessToken", () => {
  test("throws a clear error when the key is not set", async () => {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_KEY_B64", "");
    const { getAccessToken } = await loadAuth();

    await expect(getAccessToken()).rejects.toThrow(
      "GOOGLE_SERVICE_ACCOUNT_KEY_B64 is not set",
    );
  });

  test("gives the token request a 10 s timeout", async () => {
    getAccessTokenMock.mockResolvedValueOnce({ token: "tok" });
    const { getAccessToken } = await loadAuth();

    await expect(getAccessToken()).resolves.toBe("tok");
    expect(jwtOptions[0]).toMatchObject({
      transporterOptions: { timeout: 10_000 },
    });
  });

  test("a failed token request surfaces only a fixed message", async () => {
    const libraryError = Object.assign(new Error(`invalid_grant ${SECRET}`), {
      config: { data: { assertion: SECRET } },
      response: { status: 400 },
    });
    getAccessTokenMock.mockRejectedValueOnce(libraryError);
    const { getAccessToken } = await loadAuth();

    const error = (await getAccessToken().catch((e: unknown) => e)) as Error;

    expect(error.message).toBe("Google token request failed (400)");
    expect(error.cause).toBeUndefined();
    expect(Object.keys(error)).toEqual([]);
    expect(error.stack ?? "").not.toContain(SECRET);
  });
});
