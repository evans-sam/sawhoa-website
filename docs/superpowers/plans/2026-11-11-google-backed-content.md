# Google-Backed Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the prototype's stand-in content file with content read from Google Docs, Drive and Calendar, checked before it goes live, with problems reported as comments on the doc.

**Architecture:** Pure functions (slice rule, doc checker, doc converter, calendar selection, comment planning) sit under `lib/` and are unit-tested against hand-built Docs/Calendar API objects. A thin REST client (`lib/google/`) authenticates as a service account. Loaders in `lib/content/` combine the two and throw on a blocked doc; pages regenerate every 120 seconds with classic ISR, so a throw leaves the last good page in place. Two route handlers serve Drive PDFs and Docs images through the service account.

**Tech Stack:** Next.js 16.4.6 App Router (classic ISR, `cacheComponents` off), React 19.3, TypeScript, Vitest, `google-auth-library`, `@googleworkspace/google-docs-hast`, `hast-util-to-jsx-runtime`, `tsx` for scripts.

**Spec:** `docs/superpowers/specs/2026-11-11-google-backed-content-design.md` (session root). Read it first.

**Working directory:** all paths below are relative to the repository root. Run every command from there.

## Global Constraints

- Next.js 16.4.6. Its docs ship in `node_modules/next/dist/docs/`. Before writing page, route-handler or caching code, read `01-app/02-guides/incremental-static-regeneration.md` and `01-app/02-guides/caching-without-cache-components.md`. This version differs from older ones.
- `cacheComponents` and `partialPrefetching` are turned **off** (Task 1). The "last successfully generated data will continue to be served" guarantee the spec depends on is documented only in the ISR guide that covers sites without Cache Components.
- Regeneration interval: `export const revalidate = 120` in `app/layout.tsx` only. It must be a literal.
- No database. No paid service. No Google push notifications.
- Secrets only in environment: `GOOGLE_SERVICE_ACCOUNT_KEY_B64` (the JSON key file, base64-encoded). Never committed, never logged, never echoed in an error message.
- Every Google ID lives in `content/google.json`. Switching Google accounts must need only that file and the env var to change.
- Time zone for all date logic and display: `America/Denver`.
- Home slice starting values: minimum 3, soft maximum 5, guaranteed 14 days, current 90 days.
- A fetch failure or Google error must throw, never render empty content.
- Docs are read with suggestions excluded: `suggestionsViewMode=PREVIEW_WITHOUT_SUGGESTIONS`.
- No attribution lines in commit messages.
- Look and layout of the prototype stay as they are.

## Review Focus

1. **Image set to wrap text (a "positioned object").** The converter drops these without a trace. Expected: blocking problem with a comment telling the editor to set the image to "In line". Test in Task 4.
2. **Something that is not a Google Doc in the Announcements folder** (PDF, Sheet, shortcut, subfolder, trashed doc). Expected: skipped; the list still renders. Test in Task 8.
3. **A file ID the site should not serve** requested from `/files/<id>` or `/media/<docId>/<objectId>` (a Pages doc, a file outside the content folders, garbage). Expected: 404, nothing fetched for the visitor. Test in Task 9.
4. **Recurring and cancelled calendar entries.** Expected: a weekly entry appears once per upcoming occurrence; a cancelled occurrence does not appear. Tests in Task 3 (`singleEvents=true`) and Task 6 (cancelled skipped).
5. **More than one page of results** (over 100 files in a folder, over 250 calendar entries). Expected: all are listed. Test in Task 3.

---

## File Structure

```
content/settings.ts          slice numbers, time zone, events window
content/google.json          every Google ID (written by scripts/discover.ts)
lib/google/auth.ts           service-account access token
lib/google/api.ts            REST calls: docs, drive files, comments, calendar
lib/announcements/slice.ts   home slice rule
lib/docs/types.ts            Problem, minimal Docs API types used by check/convert
lib/docs/check.ts            blocking checks on a Docs API document
lib/docs/messages.ts         comment wording for each Problem
lib/docs/convert.ts          Docs API document -> hast tree + excerpt
lib/docs/comments.ts         plan and apply comment create/resolve
lib/calendar/select.ts       active banners, upcoming events (pure)
lib/content/pages.ts         loadPage
lib/content/announcements.ts listAnnouncements, loadAnnouncement
lib/content/calendar.ts      loadBanners, loadEvents
lib/content/files.ts         listNewsletters, isServablePdf
components/DocBody.tsx       hast -> React
components/Banner.tsx        stacked banners
app/news/page.tsx            all announcements
app/news/[id]/page.tsx       one announcement
app/files/[fileId]/route.ts  PDF from Drive
app/media/[docId]/[objectId]/route.ts   image from a doc
scripts/discover.ts          writes content/google.json from a root folder ID
scripts/check-content.ts     pre-deploy report of blocked docs
tests/**                     mirrors lib/
```

`content/site.ts` is deleted in Task 10 once nothing imports it.

---

### Task 0 (Sam, not the implementer): Google test account

All unit tests run without Google. These steps need this done: Task 3 steps 4-5, Task 5 step 6, Task 9 step 5, all of Tasks 10 and 12. If it is not done yet, do every other step in order and stop before Task 10.

- [ ] Follow the eight setup steps already given in chat, in a test Google account. Name the page docs in `Pages` exactly: `Home`, `About`, `FAQ`, `Buying and Selling`, `Documents`, `Pay Dues`.
- [ ] Save the key: `base64 -i <downloaded-key>.json | tr -d '\n'` and put the output in `.env.local` in the repository root as `GOOGLE_SERVICE_ACCOUNT_KEY_B64=...`. (`.env*` is already git-ignored.)
- [ ] Give the implementer: the `Website content` folder ID and the two calendar IDs.

---

### Task 1: Baseline, test runner, and the last-good-page trial

This task proves the mechanism the whole design rests on before anything is built on it.

**Files:**
- Modify: `next.config.ts`, `package.json`, `app/layout.tsx`
- Create: `vitest.config.ts`, `tests/smoke.test.ts`, `app/trial/page.tsx` (deleted at the end of the task)

**Interfaces:**
- Produces: `npm test` (Vitest, `@/` alias resolving to the repo root, node environment); site-wide `revalidate = 120`.

- [ ] **Step 1:** Commit the prototype as it stands: `git add -A && git commit -m "chore: prototype baseline"`.
- [ ] **Step 2:** In `next.config.ts` remove `cacheComponents` and `partialPrefetching`. Add `export const revalidate = 120;` to `app/layout.tsx`.
- [ ] **Step 3:** `npm i -D vitest tsx`; add scripts `"test": "vitest run"`, `"test:watch": "vitest"`. Create `vitest.config.ts` with `resolve.alias` `@` -> repo root and `test.include: ["tests/**/*.test.ts"]`. Add `tests/smoke.test.ts` asserting `1 + 1 === 2`. Run `npm test`. Expected: 1 passed.
- [ ] **Step 4: Trial page.** Create `app/trial/page.tsx`: an async server component with `export const revalidate = 5`, which reads the file `/tmp/sawhoa-trial-fail` with `fs.existsSync`; if it exists, `throw new Error("trial")`; otherwise renders `<p>ok {new Date().toISOString()}</p>`.
- [ ] **Step 5: Run the trial.** `rm -f /tmp/sawhoa-trial-fail && npm run build && npm run start -- --port 3412` (background). Then:
  1. `curl -s localhost:3412/trial` shows `ok <t1>`.
  2. `touch /tmp/sawhoa-trial-fail`, wait 6 s, `curl` three times 2 s apart. **Expected: HTTP 200 and `ok <t1>` every time** (last good page kept).
  3. `rm /tmp/sawhoa-trial-fail`, wait 6 s, `curl` twice. Expected: a new timestamp by the second request.
  4. `touch /tmp/sawhoa-trial-fail && npm run build`. **Expected: build fails**, naming `/trial`.
- [ ] **Step 6:** If 5.2 or 5.4 does not behave as expected, STOP and report to Sam; do not continue the plan. Do not add an `error.tsx` anywhere in this project: it has not been shown to preserve this behaviour.
- [ ] **Step 7:** Delete `app/trial/`, `rm -f /tmp/sawhoa-trial-fail`, run `npm run build` (expected: succeeds), commit `chore: classic ISR at 120s, vitest`.

---

### Task 2: Settings and the home slice rule

**Files:**
- Create: `content/settings.ts`, `lib/announcements/slice.ts`
- Test: `tests/announcements/slice.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // content/settings.ts
  export const settings = {
    slice: { minimum: 3, softMaximum: 5, guaranteedDays: 14, currentDays: 90 },
    timeZone: "America/Denver",
    eventsMonthsAhead: 6,
  } as const;
  export type SliceSettings = typeof settings.slice;

  // lib/announcements/slice.ts
  export function selectHomeSlice<T extends { postedAt: Date }>(
    posts: T[], now: Date, s: SliceSettings): T[];
  ```

- [ ] **Step 1: Write failing tests.** Helper `daysAgo(n)` relative to a fixed `now = 2026-11-11T18:00:00Z`. Cases, asserting the returned length and that results are newest first:
  - 7 posts aged 0-6 days -> 7
  - 2 aged 1-2 days, 6 aged 20-80 days -> 5 (the 5 newest)
  - 1 aged 30 days, 4 aged 100-400 days -> 3
  - 5 posts all aged 180+ days -> 3
  - 2 posts aged 200 days -> 2
  - no posts -> `[]`
  - input given oldest first -> output still newest first
  - a post aged exactly 14 days is not "guaranteed"; one aged 13.9 days is
- [ ] **Step 2:** Run `npm test -- slice`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** Sort newest first, then take the newest `n` where
  `n = max(guaranteedCount, min(currentCount, softMaximum), min(total, minimum))`.
- [ ] **Step 4:** `npm test -- slice`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: home announcement slice rule`.

---

### Task 3: Google client and ID discovery (needs Task 0)

**Files:**
- Create: `lib/google/auth.ts`, `lib/google/api.ts`, `scripts/discover.ts`, `content/google.json`
- Test: `tests/google/api.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // lib/google/auth.ts
  export async function getAccessToken(): Promise<string>;
  // scopes: https://www.googleapis.com/auth/drive, .../auth/calendar.readonly
  // throws Error("GOOGLE_SERVICE_ACCOUNT_KEY_B64 is not set") when missing

  // lib/google/api.ts  (every function throws GoogleError on a non-2xx response)
  export class GoogleError extends Error { status: number }
  export type DriveFile = { id: string; name: string; mimeType: string;
    createdTime: string; parents?: string[]; trashed?: boolean; size?: string };
  export type CalendarEvent = { id: string; status?: string; summary?: string;
    description?: string; location?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string } };
  export type DriveComment = { id: string; content: string; resolved?: boolean;
    author?: { me?: boolean } };

  export async function getDoc(docId: string): Promise<DocsDocument>;      // suggestions excluded
  export async function listFolder(folderId: string): Promise<DriveFile[]>; // all pages, trashed=false
  export async function getFileMeta(fileId: string): Promise<DriveFile>;
  export async function downloadFile(fileId: string): Promise<Response>;    // alt=media, body unread
  export async function listEvents(calendarId: string, timeMin: Date, timeMax: Date): Promise<CalendarEvent[]>;
      // singleEvents=true, orderBy=startTime, all pages
  export async function listComments(fileId: string): Promise<DriveComment[]>; // all pages
  export async function createComment(fileId: string, content: string): Promise<void>;
  export async function resolveComment(fileId: string, commentId: string): Promise<void>;
      // POST a reply with { action: "resolve", content: "Fixed. Thank you." }
  ```
  `DocsDocument` is defined in Task 4's `lib/docs/types.ts`; until then use `unknown`.
  `content/google.json`:
  ```json
  { "rootFolderId": "", "folders": { "pages": "", "announcements": "", "newsletters": "", "documents": "" },
    "pages": { "home": "", "about": "", "faq": "", "buyingSelling": "", "documents": "", "payDues": "" },
    "calendars": { "events": "", "banner": "" } }
  ```

- [ ] **Step 1:** `npm i google-auth-library`. Implement `getAccessToken` with `JWT` from `google-auth-library`, credentials from the decoded env var. Use plain `fetch` with a bearer header in `api.ts`; no `googleapis` package. Every Drive call must pass `fields` (the comments endpoints reject requests without it) and `supportsAllDrives=true`. Every `fetch` gets `cache: "no-store"` and a 10 s `AbortSignal.timeout`.
- [ ] **Step 2: Write failing tests** with `vi.stubGlobal("fetch", ...)` and `vi.mock("@/lib/google/auth")`:
  - `listFolder` follows `nextPageToken` across two pages and returns the files of both.
  - `listEvents` follows `nextPageToken` and sends `singleEvents=true`.
  - `getDoc` sends `suggestionsViewMode=PREVIEW_WITHOUT_SUGGESTIONS`.
  - a 500 response makes `getDoc` reject with `GoogleError` whose `status` is 500 and whose message does not contain the bearer token.
  - `resolveComment` posts to `/files/<id>/comments/<cid>/replies` with `action: "resolve"`.
- [ ] **Step 3:** Run, see FAIL; implement; run, see PASS.
- [ ] **Step 4: `scripts/discover.ts`.** Usage: `npx tsx --env-file=.env.local scripts/discover.ts <rootFolderId> <eventsCalendarId> <bannerCalendarId>`. Lists the root folder, finds the four subfolders by name (case-insensitive), lists `Pages`, matches the six doc names from Task 0 (case-insensitive), writes `content/google.json`. Exits 1 naming anything it could not find. Add script `"content:discover"`.
- [ ] **Step 5: Run it** with Sam's IDs. Expected: `content/google.json` fully populated. Then run a one-off `npx tsx --env-file=.env.local -e` that calls `listEvents` on both calendars for the next 30 days and prints the count. Expected: no error (this settles spec section 13 item 3 for the test account).
- [ ] **Step 6:** Commit `feat: google rest client and id discovery` (including `content/google.json`; IDs are not secrets).

---

### Task 4: Doc checker

**Files:**
- Create: `lib/docs/types.ts`, `lib/docs/check.ts`, `lib/docs/messages.ts`
- Test: `tests/docs/check.test.ts`, `tests/docs/builders.ts`

**Interfaces:**
- Produces:
  ```ts
  // lib/docs/types.ts
  export type DocsDocument = { documentId: string; title: string;
    body: { content: StructuralElement[] };
    inlineObjects?: Record<string, InlineObject>;
    positionedObjects?: Record<string, unknown>;
    lists?: Record<string, unknown> };
  // StructuralElement, Paragraph, ParagraphElement, InlineObject: only the fields
  // check.ts and convert.ts read, typed from the Docs API reference.
  export type ProblemKind = "empty" | "untitled" | "table" | "drawing" | "chart"
    | "equation" | "footnote" | "embedded" | "floating-image" | "image-unfetchable" | "bad-link";
  export type Problem = { kind: ProblemKind; quote: string };

  // lib/docs/check.ts
  export function checkStructure(doc: DocsDocument, opts: { requireTitle: boolean }): Problem[];
  export async function checkImages(doc: DocsDocument, fetchImpl?: typeof fetch): Promise<Problem[]>;
  export function isAllowedHref(url: string): boolean;   // http:, https:, mailto:, tel: only, parsed with new URL

  // lib/docs/messages.ts
  export function commentText(p: Problem): string;
  ```
- `tests/docs/builders.ts` produces: `doc(...elements)`, `para(...runs)`, `text(s, {link?})`, `table()`, `inlineImage(id)`, `drawing(id)`, `chart(id)`, `footnoteRef()`, `equation()`, `positioned(id)` that build minimal `DocsDocument` pieces. Tasks 5 and 8 reuse them.

Rules:
- `empty`: no paragraph has non-whitespace text and there is no inline image.
- `untitled` (only when `requireTitle`): title blank, or equal to `Untitled document` ignoring case.
- `table`: a structural element with `table`. `quote`: text of its first cell, first 60 chars.
- Inline object: `embeddedObject.imageProperties` with no `linkedContentReference` is an image (fine); with `linkedContentReference.sheetsChartReference` is `chart`; `embeddedDrawingProperties` is `drawing`; anything else is `embedded`.
- `floating-image`: any paragraph with non-empty `positionedObjectIds`.
- `footnote`: a `footnoteReference` element. `equation`: an `equation` element.
- `bad-link`: a text run or `richLink` whose `url` fails `isAllowedHref`. Links with `headingId` or `bookmarkId` and no `url` are not a problem (Task 5 renders them as plain text).
- `quote` for paragraph-level problems: that paragraph's text, first 60 chars; empty string if none.
- Ignored: `sectionBreak`, `tableOfContents`, `pageBreak`, `horizontalRule`, `person` chips, all text and paragraph styling, headers, footers.
- `checkImages`: GET each inline image's `contentUri`; non-2xx or a thrown fetch -> `image-unfetchable`.
- `commentText`: starts with `Website: `, says what is wrong and what to do, and includes the quote in double quotes when non-empty. Example for `table`: `Website: this page has a table near "Trash pickup", and the website can't show tables. Please turn it into a list or plain paragraphs. The page will keep showing its previous version until this is fixed.` Write one sentence set per kind in that voice; no jargon ("inline object", "API").

- [ ] **Step 1: Write failing tests**, one per rule above using the builders, plus:
  - a doc with bold, a 24pt purple font, centred text and a page break returns `[]`
  - a doc with only an inline image and no text is not `empty`
  - `isAllowedHref`: accepts `https://x.org`, `mailto:board@sawhoa.com`, `tel:+13035551212`; rejects `javascript:alert(1)`, `htp:/x`, `www.x.org`, `""`
  - a doc with two tables returns two problems with different quotes
  - `commentText` output for every `ProblemKind` starts with `Website: ` and is under 400 characters
  - `checkImages` with a fetch stub returning 403 yields one `image-unfetchable`
- [ ] **Step 2:** Run `npm test -- check`. Expected: FAIL.
- [ ] **Step 3:** Implement the three files.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: blocking checks for google docs`.

---

### Task 5: Doc converter

**Files:**
- Create: `lib/docs/convert.ts`, `components/DocBody.tsx`
- Test: `tests/docs/convert.test.ts`

**Interfaces:**
- Consumes: `DocsDocument` and builders from Task 4; `isAllowedHref`.
- Produces:
  ```ts
  export type Converted = { tree: import("hast").Root; excerpt: string };
  export function convertDoc(doc: DocsDocument, opts: {
    servablePdfIds: Set<string>;      // Drive links to these become /files/<id>
    faq?: boolean;                    // each doc "Heading 3" + content up to the next heading -> <details>;
                                      // doc "Heading 2" stays a category heading
  }): Converted;
  // components/DocBody.tsx
  export function DocBody({ tree }: { tree: import("hast").Root }): React.ReactElement;
  ```

- [ ] **Step 1:** `npm i @googleworkspace/google-docs-hast hast-util-to-jsx-runtime` and `npm i -D @types/hast`. Read the package's README in `node_modules` for the exact export name before use (expected: `toHast`).
- [ ] **Step 2: Write failing tests** (serialise the tree with `hast-util-to-html`, dev dependency, for assertions):
  - heading 1 in the doc becomes `<h2>`, heading 2 `<h3>` (pages keep a single `<h1>` from the site); the doc's `TITLE`-styled paragraph is dropped
  - bold, italic, link, bulleted list, numbered list each produce `strong`, `em`, `a[href]`, `ul>li`, `ol>li`
  - no element in the output has a `style` attribute or a `class` from the doc
  - inline image `kix.abc` in doc `D1` -> `<img src="/media/D1/kix.abc">` with `alt` from the object's `description` or `title`, else `""`; `loading="lazy"`
  - link to `https://drive.google.com/file/d/PDF1/view?usp=sharing` with `PDF1` in `servablePdfIds` -> `href="/files/PDF1"`; the same link with an ID not in the set is left unchanged
  - a `richLink` chip renders as `<a>` with its title as text and the same Drive rewrite
  - a link with only `headingId` renders its text with no `<a>`
  - external `http(s)` links get `rel="noopener"`; `mailto:` and `tel:` do not
  - `excerpt` is the first non-empty paragraph's plain text, trimmed, cut at 280 characters on a word boundary with `…` when cut
  - with `faq: true`, a doc of Heading 2 `Dues`, Heading 3 `How much?`, paragraph, Heading 3 `When?`, paragraph -> `<h3>Dues</h3>` followed by two `<details>`, each with the question in `<summary>` and the paragraph inside
  - a `<script>` typed as literal text in the doc appears escaped, not as an element
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4: Implement** `convertDoc` as: `toHast(doc)` then tree passes in this order: drop title, strip style/class/id, shift headings, rewrite images (map `contentUri` back to object ID through `doc.inlineObjects`), rewrite links, optional FAQ grouping, compute excerpt. If `toHast` cannot express one of the tested behaviours, write that element's conversion directly from `doc.body.content` rather than patching the library. `DocBody` uses `toJsxRuntime` with React's `jsx`/`jsxs`/`Fragment`.
- [ ] **Step 5:** Run. Expected: PASS.
- [ ] **Step 6 (needs Task 0): real-content trial.** Sam or the implementer pastes the live site's About and FAQ text into the test `About` and `FAQ` docs. Run a one-off `tsx` script that fetches both with `getDoc`, runs `checkStructure` and `convertDoc`, and prints the HTML. Read the HTML. Expected: no problems reported, headings/lists/links intact. Save the two API responses to `tests/docs/fixtures/about.json` and `faq.json` and add a test that both convert without throwing and report no problems. If the library mangles real content, replace it per Step 4's fallback before continuing.
- [ ] **Step 7:** Commit `feat: google doc to page converter`.

---

### Task 6: Calendar selection

**Files:**
- Create: `lib/calendar/select.ts`
- Test: `tests/calendar/select.test.ts`

**Interfaces:**
- Consumes: `CalendarEvent` (Task 3), `settings.timeZone`.
- Produces:
  ```ts
  export type Banner = { id: string; text: string; detail?: string };
  export type SiteEvent = { id: string; title: string; when: string;   // formatted, Denver
    location?: string; description?: string };
  export function activeBanners(events: CalendarEvent[], now: Date): Banner[];
  export function upcomingEvents(events: CalendarEvent[], now: Date): SiteEvent[];
  ```

Rules: skip entries with `status === "cancelled"` or blank `summary`. Timed entry is active when `start <= now < end`. All-day entry is active when `start.date <= today < end.date`, where `today` is the calendar date in Denver (Google's all-day `end.date` is exclusive). Banners sort by start, earliest first. `detail` and `description` are plain text: strip HTML tags Google Calendar stores in descriptions. Upcoming: entries whose end is after `now`, soonest first. `when` examples: `Sat, Nov 14, 2026, 6:30 – 8:00 PM`, `Sat, Nov 14, 2026` (all-day), `Nov 14 – 16, 2026` (multi-day all-day).

- [ ] **Step 1: Write failing tests:**
  - all-day banner dated 2026-11-11 is active at `2026-11-12T06:30:00Z` (11:30 PM Nov 11 in Denver) and not at `2026-11-12T07:30:00Z`
  - timed banner that ended one minute before `now` is not active; one starting one minute after `now` is not active
  - two overlapping banners both return, earliest start first
  - blank-summary and cancelled entries are skipped by both functions
  - description `<b>Bring</b> chairs<br>and snacks` -> `Bring chairs and snacks`
  - an event that started an hour ago and ends in an hour is still listed in `upcomingEvents`
  - the three `when` formats above, including a time crossing the November DST change
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement with `Intl.DateTimeFormat` only; no date library. **Step 4:** Run, PASS.
- [ ] **Step 5:** Commit `feat: banner and event selection`.

---

### Task 7: Comment sync

**Files:**
- Create: `lib/docs/comments.ts`
- Test: `tests/docs/comments.test.ts`

**Interfaces:**
- Consumes: `Problem`, `commentText` (Task 4); `DriveComment`, `listComments`, `createComment`, `resolveComment` (Task 3).
- Produces:
  ```ts
  export function planComments(problems: Problem[], existing: DriveComment[]):
    { create: string[]; resolve: string[] };   // comment texts to post; comment IDs to resolve
  export async function syncComments(fileId: string, problems: Problem[]): Promise<void>;
  ```

Rules: only comments with `author.me === true`, `resolved !== true`, and content starting `Website: ` count as ours. `create` = wanted texts not already open (de-duplicated). `resolve` = our open comments whose text is no longer wanted. `syncComments` never throws: a comment failure is logged with `console.error` and swallowed, so it cannot mask the block or break a passing page.

- [ ] **Step 1: Write failing tests:**
  - one problem, no existing comments -> one create, no resolve
  - same problem already open -> nothing to do (run twice: still nothing)
  - no problems, two of our comments open -> both resolved
  - a human's open comment and our already-resolved comment are never touched
  - two identical problems -> one create
  - `syncComments` resolves normally when `createComment` rejects
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement. **Step 4:** Run, PASS.
- [ ] **Step 5:** Commit `feat: report blocked docs as comments`.

---

### Task 8: Content loaders (needs Task 0)

**Files:**
- Create: `lib/content/pages.ts`, `lib/content/announcements.ts`, `lib/content/calendar.ts`, `lib/content/files.ts`
- Test: `tests/content/announcements.test.ts`, `tests/content/pages.test.ts`, `tests/content/files.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2-7; `content/google.json`.
- Produces:
  ```ts
  export class BlockedError extends Error { docTitle: string; docUrl: string; problems: Problem[] }
  // message: `Blocked: "<title>" (https://docs.google.com/document/d/<id>/edit): <kinds joined>`

  // lib/content/pages.ts
  export type PageKey = "home" | "about" | "faq" | "buyingSelling" | "documents" | "payDues";
  export const loadPage: (key: PageKey) => Promise<Converted>;      // React cache()-wrapped; throws BlockedError

  // lib/content/announcements.ts
  export type Announcement = { id: string; title: string; postedAt: Date; excerpt: string };
  export const listAnnouncements: () => Promise<Announcement[]>;    // newest first, passing docs only
  export const loadAnnouncement: (id: string) =>
    Promise<(Announcement & Converted) | null>;                     // null: not in folder / draft / not a doc
  export function isDraft(title: string): boolean;                  // /^\s*draft/i

  // lib/content/calendar.ts
  export const loadBanners: () => Promise<Banner[]>;
  export const loadEvents: () => Promise<SiteEvent[]>;              // now .. now + eventsMonthsAhead

  // lib/content/files.ts
  export type PdfLink = { id: string; name: string; href: string; createdAt: Date };
  export const listNewsletters: () => Promise<PdfLink[]>;           // newest first; name without ".pdf"
  export const servablePdfIds: () => Promise<Set<string>>;          // PDFs in Newsletters + Documents
  ```

Behaviour:
- Shared `loadDoc(id, {requireTitle, faq})`: `getDoc` -> `checkStructure` + `checkImages` -> `syncComments(id, problems)` (always, so fixed docs get their comments resolved) -> if problems, throw `BlockedError` -> else `convertDoc`.
- `listAnnouncements`: `listFolder(announcements)`, keep `mimeType === "application/vnd.google-apps.document"` and not `isDraft`, load each with `loadDoc` in parallel (limit 5 at a time). A doc that throws `BlockedError` is left out of the list. Any other error (Google down) propagates. `postedAt` = `createdTime`.
- `loadAnnouncement(id)`: `getFileMeta`; return `null` unless it is a Google Doc whose `parents` include the announcements folder and it is not a draft or trashed; a 404 from Google also returns `null`. Then `loadDoc`; `BlockedError` propagates.
- `listNewsletters`: `mimeType === "application/pdf"` only.

- [ ] **Step 1: Write failing tests** with `vi.mock("@/lib/google/api")`:
  - Announcements folder holding a Doc, a `DRAFT budget` Doc, a ` draft: picnic` Doc, a PDF, a Sheet, a shortcut and a subfolder -> `listAnnouncements` returns only the first Doc
  - three Docs, the middle one containing a table -> two returned, `createComment` called once for the middle doc, no throw
  - `listFolder` rejecting with `GoogleError` -> `listAnnouncements` rejects
  - `loadAnnouncement` returns `null` for: a doc whose parent is the Pages folder, a draft, a PDF, a 404
  - `loadPage("about")` on a doc with a table throws `BlockedError` whose message contains the doc title and URL
  - `loadPage` on a clean doc that has one stale `Website: ` comment -> `resolveComment` called
  - `listNewsletters`: `2026 Fall Newsletter.pdf` -> name `2026 Fall Newsletter`, href `/files/<id>`; ordered by `createdTime` descending; a `.docx` in the folder is skipped
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement. **Step 4:** Run, PASS.
- [ ] **Step 5:** Commit `feat: content loaders`.

---

### Task 9: File and image routes

**Files:**
- Create: `app/files/[fileId]/route.ts`, `app/media/[docId]/[objectId]/route.ts`, `lib/content/media.ts`
- Test: `tests/content/media.test.ts`

**Interfaces:**
- Consumes: `servablePdfIds`, `getFileMeta`, `downloadFile`, `getDoc`, `content/google.json`.
- Produces:
  ```ts
  // lib/content/media.ts
  export async function openPdf(fileId: string): Promise<Response | null>;
  export async function openDocImage(docId: string, objectId: string): Promise<Response | null>;
  ```
  Routes return the `Response` or a 404.

Behaviour:
- `openPdf`: reject IDs not matching `/^[\w-]{10,}$/` without calling Google; `getFileMeta`; return `null` unless `mimeType` is `application/pdf`, not trashed, and `parents` includes the newsletters or documents folder. Stream `downloadFile`'s body through with `Content-Type: application/pdf`, `Content-Disposition: inline; filename="<name>"`, `Cache-Control: public, max-age=300, s-maxage=3600`.
- `openDocImage`: allowed `docId`s are the six page docs and any Doc whose parent is the announcements folder; otherwise `null`. `getDoc`, look up `inlineObjects[objectId]...contentUri`, fetch it, stream through with its content type and `Cache-Control: public, max-age=86400, s-maxage=604800, immutable` (an object ID changes when the image is replaced).
- Both route files: `export const dynamic = "force-dynamic"`; in this Next version `params` is a Promise, await it.

- [ ] **Step 1: Write failing tests** (API mocked):
  - `openPdf` returns `null` for: a Pages doc ID, a PDF whose parent is some other folder, a trashed PDF, `../etc`, `""`; and for the last two `getFileMeta` is not called
  - `openPdf` on a newsletter PDF returns 200 with `application/pdf` and the body bytes
  - `openDocImage` returns `null` for a doc ID outside the allowed set and for an unknown `objectId`
  - `openDocImage` on a page doc image returns the bytes with the upstream content type
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement. **Step 4:** Run, PASS.
- [ ] **Step 5 (needs Task 0):** `npm run dev -- --port 3411`, open `/files/<test newsletter id>` and confirm the PDF displays in the browser without being signed in to Google.
- [ ] **Step 6:** Commit `feat: serve drive pdfs and doc images`.

---

### Task 10: Wire the pages (needs Task 0)

**Files:**
- Modify: `app/layout.tsx`, `app/page.tsx`, `app/about/page.tsx`, `app/faq/page.tsx`, `app/buying-selling/page.tsx`, `app/documents/page.tsx`, `app/pay-dues/page.tsx`, `app/newsletters/page.tsx`, `app/events/page.tsx`, `app/globals.css`, `components/Sidebar.tsx` (only if it imports `content/site`)
- Create: `components/Banner.tsx`, `app/news/page.tsx`, `app/news/[id]/page.tsx`, `content/static.ts`
- Delete: `content/site.ts`

**Interfaces:**
- Consumes: all loaders (Task 8), `DocBody` (Task 5), `selectHomeSlice` (Task 2), `settings`.

Decisions:
- Each fixed page keeps its `<h1>` and `metadata` in code and renders `<DocBody tree={(await loadPage(key)).tree} />` below it. FAQ passes `faq: true` (already inside `loadPage` for key `faq`).
- Home: intro `DocBody`, then the slice: for each entry headline (link to `/news/<id>`), date formatted `November 11, 2026` in Denver, excerpt. Below the slice, a link `All news` to `/news`.
- `/news`: every announcement, same entry layout. `/news/[id]`: `<h1>` = doc title, date, body; `generateStaticParams` returns the IDs from `listAnnouncements()`; `dynamicParams` left at its default (true); `loadAnnouncement` returning `null` -> `notFound()`; `generateMetadata` sets the title.
- Pay Dues: `DocBody` replaces the lede and steps; the dues box with the inert button and its "isn't connected yet" hint stays in code.
- Events: replace the iframe with a list of `loadEvents()` using the existing feed styles; when empty, `No upcoming events. Check back soon.`
- Newsletters: list from `listNewsletters()` using the existing `files` styles; links open `/files/<id>`.
- `Banner`: `loadBanners()` in `app/layout.tsx`; one strip per banner using the existing banner style, `text` in bold and `detail` on a second line; renders nothing when there are none.
- Add "News" to the nav after Home.
- What is left of `content/site.ts` that is not content (header image URLs, nav) moves to `content/static.ts`. Download the header images the prototype hot-links from the old site into `public/` and reference them locally.
- Remove the prototype-only notes (`className="note"` paragraphs, "Prototype:" hints) except the Pay Dues hint.
- Do not catch loader errors in pages or layout: a throw is what keeps the last good page.

- [ ] **Step 1:** Put representative content in the six test docs, two announcement docs, one event, one banner entry for today, one newsletter PDF.
- [ ] **Step 2:** Implement the pages as above. `grep -r "content/site" app components lib` returns nothing; delete `content/site.ts`.
- [ ] **Step 3:** `npm test && npm run lint && npm run build`. Expected: all pass; build output lists every route including `/news/[id]` with the two IDs.
- [ ] **Step 4: Live check** with `npm run start -- --port 3411`, at desktop width and at 375 px:
  1. Every nav page renders its doc content; banner shows; events and newsletters list.
  2. Edit a sentence in the test `About` doc; within about two and a half minutes and two reloads the page shows it.
  3. Insert a table in `About`; reload after the interval: page still shows the previous text; the doc has one `Website:` comment. Reload three more times over five minutes: still one comment.
  4. Delete the table; after the interval and a reload the page updates and the comment is resolved.
  5. Add an announcement doc titled `DRAFT test`: it appears nowhere. Remove `DRAFT`: it appears on Home and `/news`.
  6. With the table back in `About`, run `npm run build`. Expected: build fails and the output contains `Blocked: "About"` and the doc URL. Remove the table.
- [ ] **Step 5:** Commit `feat: pages read from google`.

---

### Task 11: Pre-deploy check command and handover notes

**Files:**
- Create: `scripts/check-content.ts`, `README.md` (replace the create-next-app one)
- Test: `tests/content/report.test.ts`
- Modify: `package.json`, `lib/content/pages.ts` / `announcements.ts` only if needed to share code

**Interfaces:**
- Produces:
  ```ts
  // lib/content/report.ts
  export type Report = { blocked: { title: string; url: string; problems: Problem[] }[];
                         errors: string[] };       // errors: Google unreachable etc.
  export async function buildReport(): Promise<Report>;   // read-only: never posts or resolves comments
  ```
  `npm run content:check` prints one line per blocked doc with its problems in the `commentText` wording, exits 1 if `blocked` or `errors` is non-empty, else prints `All content OK` and exits 0.

- [ ] **Step 1: Write failing tests** (API mocked): clean content -> empty report; a tabled page doc and a tabled announcement both appear in `blocked`; a draft announcement is not checked; `createComment` and `resolveComment` are never called; a `GoogleError` from one doc lands in `errors` and the other docs are still checked.
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement `buildReport` and the script (`tsx --env-file=.env.local`). **Step 4:** Run, PASS.
- [ ] **Step 5:** Write `README.md`, one page: what lives where in Google; how to run locally; the env var; `content:discover` and how to switch to the board@sawhoa.com account (re-run discover, replace the env var); `content:check` before deploying; where to change the slice numbers; that the 120 s interval is the literal in `app/layout.tsx`.
- [ ] **Step 6:** Commit `feat: pre-deploy content check`.

---

### Task 12: Remaining trials, reported to Sam (needs Task 0)

No code. Each result goes in the final report and, where it changes a fact, into the spec's section 13.

- [ ] **Comment emails (spec 13.1).** With a second Google account added as editor on the test folder, block a doc and see whether that account receives an email about the service account's comment. Report yes or no. Either answer is accepted by the spec; do not build an email path.
- [ ] **PDF size.** Report the size of the largest PDF on the current site's newsletter and documents pages. Vercel limits function response sizes; note that large PDFs must be tested on Vercel in the go-live project before relying on `/files/`.
- [ ] **Quota.** From the Cloud console's API metrics after Task 10's live check, report requests per regeneration and confirm it is far inside the free quotas.
- [ ] **board@sawhoa.com sharing (spec 13.3)** stays open until that account is set up; say so.
