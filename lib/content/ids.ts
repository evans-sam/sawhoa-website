import google from "@/content/google.json";

type Ids = typeof google;
type Section = "folders" | "pages" | "calendars";

/**
 * A Google ID from content/google.json. Throws when it is empty, so Google is
 * never called with a blank ID.
 */
export function googleId<S extends Section>(section: S, key: keyof Ids[S] & string): string {
  const id = (google[section] as Record<string, string>)[key];
  if (!id) {
    throw new Error(
      `content/google.json has no ${section}.${key}. Run \`npm run content:discover\` to fill in the Google IDs.`,
    );
  }
  return id;
}
