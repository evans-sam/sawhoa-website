import { cache } from "react";
import { loadDoc } from "@/lib/content/doc";
import { googleId } from "@/lib/content/ids";
import type { Converted } from "@/lib/docs/convert";

export type PageKey = "home" | "about" | "faq" | "buyingSelling" | "documents" | "payDues";

/** The page's Google Doc, converted. Throws BlockedError when the doc is blocked. */
export const loadPage = cache(async (key: PageKey): Promise<Converted> => {
  const { tree, excerpt } = await loadDoc(googleId("pages", key), {
    requireTitle: false,
    faq: key === "faq",
  });
  return { tree, excerpt };
});
