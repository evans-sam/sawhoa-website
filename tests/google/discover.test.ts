import { describe, expect, test } from "vitest";
import type { DriveFile } from "@/lib/google/api";
import { findFolders, findPageDocs } from "@/lib/google/discover";

const FOLDER = "application/vnd.google-apps.folder";
const DOC = "application/vnd.google-apps.document";

function entry(id: string, name: string, mimeType: string): DriveFile {
  return { id, name, mimeType, createdTime: "2026-11-01T00:00:00Z" };
}

const rootFiles = [
  entry("f-pages", "pages", FOLDER),
  entry("f-ann", "ANNOUNCEMENTS", FOLDER),
  entry("f-news", "Newsletters", FOLDER),
  entry("f-docs", "documents", FOLDER),
  entry("x-readme", "Read me", DOC),
];

const pageFiles = [
  entry("d-home", "home", DOC),
  entry("d-about", "About", DOC),
  entry("d-faq", "faq", DOC),
  entry("d-buy", "BUYING AND SELLING", DOC),
  entry("d-docs", "Documents", DOC),
  entry("d-dues", "pay dues", DOC),
];

describe("findFolders", () => {
  test("matches the four subfolders by name, ignoring case", () => {
    expect(findFolders(rootFiles)).toEqual({
      pages: "f-pages",
      announcements: "f-ann",
      newsletters: "f-news",
      documents: "f-docs",
    });
  });

  test("names a missing subfolder", () => {
    const withoutNewsletters = rootFiles.filter((f) => f.id !== "f-news");
    expect(() => findFolders(withoutNewsletters)).toThrow(/"Newsletters"/);
  });

  test("ignores a file that has a folder's name but is not a folder", () => {
    const files = [
      ...rootFiles.filter((f) => f.id !== "f-docs"),
      entry("x-docs", "Documents", DOC),
    ];
    expect(() => findFolders(files)).toThrow(/"Documents"/);
  });

  test("names a folder that appears twice", () => {
    const files = [...rootFiles, entry("f-pages-2", "Pages", FOLDER)];
    expect(() => findFolders(files)).toThrow(/"Pages"/);
  });
});

describe("findPageDocs", () => {
  test("matches the six page docs by name, ignoring case", () => {
    expect(findPageDocs(pageFiles)).toEqual({
      home: "d-home",
      about: "d-about",
      faq: "d-faq",
      buyingSelling: "d-buy",
      documents: "d-docs",
      payDues: "d-dues",
    });
  });

  test("names every missing page doc", () => {
    const files = pageFiles.filter((f) => !["d-faq", "d-dues"].includes(f.id));
    expect(() => findPageDocs(files)).toThrow(/"FAQ".*"Pay Dues"/);
  });
});
