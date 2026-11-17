# Build status and handoff

Last updated 2026-11-16. Read this first when picking the work up in a new session.

## What this repo is

The rebuild of sawhoa.com for the Sixth Avenue West HOA (Golden, Colorado): a small Next.js
site whose content lives in Google Docs, Drive and Calendar so non-technical board members
can edit it. Sam Evans is the technical owner. Budget is under $500 a year; everything in
use so far is free.

The rebuild is four projects, done in order. Each gets its own design and plan.

| # | Project | State |
|---|---|---|
| 1 | Google-backed content | In progress: 9 of 12 tasks done |
| 2 | Dues: Stripe-hosted checkout writing a row to a Google Sheet | Not started, no design yet |
| 3 | Email sign-up and mailing list | Not started, no design yet |
| 4 | Going live: domain, board@ email, retire WordPress | Not started, no design yet |

## Documents

- Design for project 1: `docs/superpowers/specs/2026-11-11-google-backed-content-design.md`.
  Updated 2026-11-16 with everything decided during the build (marked "Ruled in build").
- Plan for project 1: `docs/superpowers/plans/2026-11-11-google-backed-content.md`.
  Completed steps are ticked. Task 10 carries a note listing the real function names.

## Where project 1 stands

Merged to `main` (pull request 1, squash-merged):

- Tasks 1-9: baseline and test runner, home announcement rule, Google client and ID
  discovery script, doc checker and comment wording, doc converter, banner and event
  selection, comment sync, content loaders, PDF and image routes.
- 299 tests pass; `npx tsc --noEmit`, `npm run lint` and `npm run build` are clean.

**The site still shows stand-in content.** The pages read `content/site.ts`; nothing is wired
to the loaders until Task 10. Nothing has ever run against real Google.

### Blocked on Sam: the Google test account (plan Task 0)

`board@sawhoa.com` is the intended owner but Sam cannot reach it yet, so the build uses a
separate test Google account. Sam has the setup steps. What the next session needs from him:

1. The `Website content` folder ID and the two calendar IDs.
2. The service-account key, base64-encoded, in `.env.local` as
   `GOOGLE_SERVICE_ACCOUNT_KEY_B64`. Never pasted into chat, never committed.

The six page docs must be named `Home`, `About`, `FAQ`, `Buying and Selling`, `Documents`,
`Pay Dues`.

### What to do next, in order

1. Task 3 Step 5: `npm run content:discover <rootFolderId> <eventsCalId> <bannerCalId>`, then
   a calendar read. Fills `content/google.json`.
2. Task 5 Step 6: run the converter on the real About and FAQ text; save fixtures.
3. Task 9 Step 5: view a PDF through `/files/<id>` without being signed in to Google.
4. Task 10: wire the pages, add the News pages, live check.
5. Task 11: pre-deploy check command and README.
6. Task 12: remaining trials, reported to Sam.
7. A final whole-codebase review, with the deferred minor items below as its checklist.

Things to confirm on the first live run, none yet verified:

- `supportsAllDrives=true` is accepted on the Drive comment endpoints, and `fields=id`
  alongside `alt=media` on downloads. If Google rejects either, drop it for that call.
- Docs data shapes taken from the API reference only: `dateElement.dateElementProperties.displayText`,
  list `glyphType` versus `glyphSymbol`, and `\u000b` as the soft line break.
- Drive returns a comment's text exactly as posted. The one-comment-per-problem rule
  matches text exactly; if Drive alters it, comments would repeat on every regeneration.
- Whether editors get an email when the service account comments (design section 13.1).

## How the work has been run

Built with the superpowers subagent-driven-development workflow: one implementer subagent
per task, a reviewer after each, on Opus at Sam's request. To continue the same way, invoke
that skill with the plan path and say Tasks 1-9 are complete.

The first session's working notes (per-task reports, review diffs, a progress ledger) are in
`.superpowers/sdd/2026-11-11-google-backed-content/` on Sam's machine only; that folder is
excluded from git. This file replaces it as the record. Commit hashes in those notes predate
a history rewrite and the squash merge, so match by commit subject if you ever need them.

## Decisions made during the build

Each is also written into the design where it changes behaviour. Sam has been told all of
them and may overturn any.

1. **`cacheComponents` is off; classic ISR at 120 seconds.** The keep-the-last-good-page
   guarantee is documented only for that mode. A local trial confirmed it: a failed
   regeneration kept serving the old page, and a throwing page failed the build. After a
   failed regeneration the next retry waits a full 120 seconds. Not yet confirmed on Vercel.
2. **No `error.tsx` anywhere.** It has not been shown to preserve the behaviour above.
3. **Converter is in-house** (`lib/docs/convert.ts`); `@googleworkspace/google-docs-hast` was
   dropped. Reasons are in design section 9.
4. **Vitest is pinned to 4.x.** Version 5 needs `@types/node` 22 or later. Upgrade both
   together later.
5. **PDF download timeout covers time-to-start only.** A whole-request 10-second limit would
   cut off large newsletters mid-stream. Every other Google call keeps the 10-second limit.
6. **Sign-in errors are replaced with a fixed message** so no credential can reach a log.
7. **Only a doc's first tab is the page.** Other tabs are ignored without comment.
8. **Comment wording** ends "The website won't show this change until it's fixed."
9. **Date chips render as text; people chips as a plain name; a link on an image is kept
   only if it is a normal web, email or phone link.**
10. **A temporary image-fetch failure is not a doc problem.** Timeouts, 408, 429 and 5xx
    throw, so the last good page stays and no comment is posted. Only a definite 4xx, or an
    image with no address, blocks.
11. **A malformed announcement address answers "not found"** without contacting Google.
12. **Drafts are hidden everywhere, images included.** One rule, `isPublishedAnnouncement`,
    decides what counts as published.
13. **Image responses carry a restrictive Content-Security-Policy; PDFs do not**, because a
    sandboxed PDF will not display in Chrome's built-in viewer.
14. **Concurrent regenerations can each post a comment.** Accepted; no locking.

## Deferred minor items (for the final review)

- `npm audit` reports moderate findings from existing tooling; not looked at.
- Vitest alias root has a trailing slash (works).
- Two home-slice tests assert length, not which posts.
- `scripts/discover.ts` writes relative to the current directory; name-matching with
  surrounding whitespace is untested.
- A doc that is only a drawing reports both "empty" and "drawing"; a quote containing
  double quotes nests them in the comment text.
- Converter: odd list nesting is untested; hrefs are emitted as typed, not normalised.
- Calendar: the HTML-tag stripper removes text like `a<b and c>d` and leaves HTML comments.
- A file chip with no properties blocks in the checker but renders as nothing.
- Events window: "six months ahead" overflows by a few days at month ends.
- Announcements: a doc the service account has lost access to becomes "not found" on its
  own page; an omitted (blocked) announcement leaves no log line; no test for a listed file
  whose parents omit the folder.
- Routes: a Drive rate limit (403) shows as "not found"; the time-to-start timeout is
  written twice (`lib/google/api.ts`, `lib/content/media.ts`); a blocked page doc's images
  are still served.

## Hosting and repository

- GitHub: `evans-sam/sawhoa-website`, public. `main` is the default branch.
- Commits use Sam's GitHub no-reply address (set in this repo's git config). Keep it that
  way: he chose it so his personal address is not in public history.
- No attribution lines in commit messages or pull request descriptions.
- CI is a GitHub Actions workflow, `.github/workflows/ci.yml`: tests, type check, lint and
  build on every pull request and every push to `main`. Vercel CI was considered and ruled
  out because it does not support public repositories. Once Task 10 lands the build step
  reads Google, so it will need `GOOGLE_SERVICE_ACCOUNT_KEY_B64` as a GitHub repository
  secret; GitHub does not give secrets to pull requests from forks, so those would fail
  the build step.
- Vercel appears to be connected: its bot opened pull requests 2 (Speed Insights) and 3
  (Web Analytics) on 2026-11-16. They are open and unreviewed, and are not part of the plan.
  Vercel's free plan is for non-commercial use; whether an HOA taking dues qualifies is a
  question for the go-live project.
- Until Task 3 Step 5 has run, a Vercel build of the stand-in pages works. Once Task 10
  lands, every build reads Google, so the project needs `GOOGLE_SERVICE_ACCOUNT_KEY_B64`
  set in Vercel, and a blocked doc or a Google outage fails the deploy by design.

## Other things that exist

- Two Wix prototypes from the platform comparison, both in Sam's Wix account. Sam chose the
  custom build; the Wix sites are unused. One is published on a free Wix address. Do not
  delete either without being asked.
- The current live site is WordPress at sawhoa.com. Its copy and PDFs have not been moved;
  that is a separate step once `board@sawhoa.com` is reachable (design section 2).
