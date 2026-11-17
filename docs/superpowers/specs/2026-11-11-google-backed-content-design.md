# SAWHOA website: Google-backed content

Design, 2026-11-11. First of four projects for the custom rebuild of sawhoa.com.

Labels used below: **Decided** = Sam said it. **My call** = Claude chose it; Sam has not
agreed to it and may overturn it. **Builder** = left to whoever builds it. **Ruled in
build** = settled while building, where this document was silent or the plan was wrong;
Sam was told and may overturn it.

Build progress, what is left, and how to resume: `docs/superpowers/STATUS.md`.

## 1. Intent

The Sixth Avenue West HOA (532 homes, Golden, Colorado; voluntary membership) is replacing
an old WordPress site with a small custom Next.js site. Board members are not technical and
rotate over time. Sam Evans is the technical owner for roughly the next five years.

This project makes the site's content live in Google tools the board already uses, so that:

- a board member fixes a line by opening a Google Doc, editing it, and waiting a few minutes;
- nobody learns a new tool or gets a new login;
- a board member cannot break a live page;
- the site can be replaced later without the board losing content or relearning anything.

Budget is close to zero. Every service used here must be free at this scale.

## 2. Scope

**In this project**

- Page copy for the fixed pages, read from Google Docs.
- Announcements: one Google Doc per announcement, a slice on the home page, a news page
  listing all of them, and a page per announcement.
- A time-bound notice banner, driven by a Google Calendar.
- Upcoming events, driven by a Google Calendar.
- Newsletter PDFs listed from a Google Drive folder.
- Document PDFs (covenants, bylaws, and so on) linked from the Documents page.
- Checking content before it goes live, and telling the editor when it is blocked.

**Other projects, not this one** (each gets its own design, in this order)

1. Dues: Stripe-hosted checkout writing a row to a Google Sheet.
2. Email sign-up and mailing list.
3. Going live: hosting, moving the domain and board@ email, retiring WordPress.

Until project 1, the Pay Dues page is copy with a button that goes nowhere.

**Also not this project (Decided):** moving the existing WordPress copy and PDFs into Google.
That is a separate step once Sam has access to `board@sawhoa.com`. This project is done when
the site works end to end against test content.

## 3. Goals, non-goals, anti-goals

**Goals**

- Edit a doc, see it on the site within a few minutes. (Decided: "a few minutes is fine".)
- A blocking problem keeps the old page live and leaves a comment on the doc. (Decided.)
- Non-blocking oddities, such as an unsupported font, are ignored without comment. (Decided.)
- Posting an announcement is: create a doc in a folder and write.
- A banner shows between a start and an end and then goes away by itself. (Decided.)
- Announcements never expire; a news page lists all of them. (Decided.)

**Non-goals**

- The board adding, removing, renaming or reordering pages or menu items. The page set is
  fixed; changes come through Sam. (Decided: "just edit existing pages and post
  announcements for now".)
- A positive "your change is live" signal. Success is silent. (My call.)
- A preview-before-publish workflow, beyond the DRAFT title prefix in section 6.
- A month-grid calendar view. Events render as an upcoming list. (My call.)
- Site search.
- Reporting problems on calendar entries back to the editor. A bad entry is skipped.

**Anti-goals** (failure even if it technically works)

- A board member's edit takes a page down or shows visitors something visibly broken.
- The site goes down or goes blank because Google is slow or unreachable.
- A doc accumulates stale warning comments that no longer apply.
- The board has to change a sharing setting, or follow a naming rule they can get wrong
  with bad results, for ordinary content to work.
- The service account key ends up in the repository.

## 4. Accounts and access

- **Owner (Decided):** `board@sawhoa.com` owns the content folder, the calendars, and the
  Google Cloud project. Assumed to be a Google account; setting that up is a prerequisite
  Sam handles.
- **Editors:** board members, with their own Google accounts, added as editors on the one
  content folder and the calendars. Joining or leaving the board is adding or removing them
  there.
- **The site (Decided):** reads Google through a service account. No OAuth consent flow, no
  human login, nothing a person renews. The service account is shared on the content folder
  as **Commenter** (it must post comments) and on the calendars with read access. Its key is
  a secret setting on the host and never in the repo.
- The service account must not own content.
- **Test account first (Decided):** Sam cannot reach `board@sawhoa.com` yet, so the build
  runs against a different Google account holding the same layout with test content only.
  Moving to `board@sawhoa.com` later must be a settings change and a new key, with no code
  change: every folder, doc and calendar ID and the service account identity come from
  settings. Real content is never authored in the test account, because copying docs
  between accounts resets their created time and so re-dates announcements.

**Content layout in Drive** (My call)

```
Website content/            (owned by board@sawhoa.com)
  Pages/                    one doc per fixed page
  Announcements/            one doc per announcement
  Newsletters/              PDFs
  Documents/                PDFs linked from the Documents page
```

Plus two calendars: **Events** and **Banner**.

## 5. Pages

Fixed pages, each tied to exactly one Google Doc by its permanent file ID, so renaming or
moving a doc cannot break the site:

| Page | Source |
|---|---|
| Home | Intro doc, plus banner and the announcements slice |
| About | Doc |
| FAQ | Doc |
| Buying/Selling | Doc |
| Documents | Doc whose links point at PDFs in the Documents folder (My call) |
| Pay Dues | Doc (button inert until the dues project) |
| Newsletters | Automatic list of the Newsletters folder |
| Events | Upcoming entries from the Events calendar |
| News | All announcements, newest first |
| News item | One announcement |

The page-to-doc mapping, folder IDs and calendar IDs live in one settings file in the site.

## 6. Announcements

- One Google Doc per announcement in the Announcements folder. Doc title is the headline,
  body is the text, the doc's created time is the post date. (My call. Known limit: no
  backdating or date correction.)
- A doc whose title starts with `DRAFT` (any case) is ignored everywhere. (My call.)
  "Everywhere" includes its images: the image route refuses a draft's pictures. (Ruled in
  build.)
- Deleting a doc, or moving it out of the folder, removes the post. No separate unpublish.
- Each announcement has its own page. Its address must not change when the title is edited.
  (Builder: how; the doc's file ID is the stable handle.)
- The news page lists every announcement, newest first, indefinitely.

**Home page slice (Decided in shape; values are My call)**

Four numbers in the settings file, changed by Sam, not by the board:

| Setting | Starting value |
|---|---|
| Minimum shown | 3 |
| Soft maximum | 5 |
| Guaranteed period | 14 days |
| Current period | 90 days |

Rule, newest first:

1. Every announcement newer than the guaranteed period shows, even past the soft maximum.
2. Announcements still within the current period fill in up to the soft maximum.
3. If fewer than the minimum are showing, the most recent older ones fill in up to it.

| Situation | Shows |
|---|---|
| 7 posted this week | all 7 |
| 2 this week, 6 more in the last 90 days | 5 |
| 1 in the last 90 days | 3 (that one plus the two most recent older) |
| nothing for six months | the 3 most recent |

Each home page entry shows headline, date and the opening paragraph, linking to its page.
(My call.)

## 7. Banner and events

**Banner** (Decided: time-bound, calendar-driven)

- Any entry on the Banner calendar that is in progress right now shows as a strip across the
  top of every page. Entry title is the banner text; the description, if present, is a
  second line. (My call.)
- Overlapping entries all show, stacked, earliest start first. (My call.)
- Times are read in America/Denver. All-day entries cover whole local days.

**Events**

- The Events page lists upcoming entries from the Events calendar: title, date and time,
  location, description. Read through the API and rendered by the site, not Google's embed,
  so the calendar does not have to be made public and the styling matches. (My call.)
- How far ahead to list. (Builder; six months is a reasonable start.)

A calendar entry with a problem (for example no title) is skipped, silently.

## 8. PDFs

- **Newsletters:** every PDF in the Newsletters folder is listed, named from its file name
  without the extension, newest first by the file's created time. (My call. Consequence:
  when migrating the seven existing newsletters, upload them oldest first.)
- **Documents:** the Documents doc links to PDFs in the Documents folder. Replacing a file
  with a new version in Drive keeps the same link.
- The board must not have to set "anyone with the link" sharing for PDFs to work. Serving
  them through the site using the service account is the obvious route. (Builder: how.)
- Built as two routes: `/files/<id>` serves a PDF only if it sits in the Newsletters or
  Documents folder; `/media/<docId>/<objectId>` serves an image only from a page doc or a
  published announcement. Anything else answers "not found". (Ruled in build.)

## 9. How content gets to the site

- The site regenerates pages on a timer using Next.js incremental static regeneration:
  a page is served from cache, and when its cached copy is older than the interval the next
  visit triggers a rebuild in the background. Interval: about two minutes. (My call, within
  the decided "a few minutes".)
- No Google change notifications. They expire daily and need renewing; the timer is sturdier.
- If a rebuild throws, Next.js keeps serving the last good page and retries later. This is
  documented behaviour in the Next.js version in use and is what makes "cannot break a live
  page" work. The checks in section 10 are built on it.
- If Google is unreachable, slow, or returns an error, treat it the same way: keep the last
  good content. Never render an empty page because a fetch failed.
- Hosting assumption: Vercel's free tier, which Sam named at the outset. The site needs a
  host that runs Next.js server features; a fully static export will not do. Whether the
  free tier's terms suit an HOA taking dues is a question for the go-live project.
- Regeneration is driven by visits. A page nobody visits is not rebuilt, and a blocked doc
  gets its comment only once someone next loads that page. In practice the editor loads the
  page to see their change, which triggers both. (My call: accept this. If it proves too
  slow, add a free scheduled visit, for example a GitHub Actions schedule; do not build it
  up front.)

**Converting a Google Doc**

- Read docs through the Google Docs API with suggestions excluded, so pending suggested
  edits never reach the site.
- Converter (Ruled in build): written in-house, in `lib/docs/convert.ts`. It turns the API
  response into an HTML tree (hast) the site restyles.
  - The original call was `@googleworkspace/google-docs-hast`, with an in-house converter
    named as the fallback. Reading the library's source during the build showed it carries
    the doc's inline styles and classes into the page, loses bold and italic inside links,
    has no date-chip support, logs a warning on every section break, and throws on a missing
    object. The fallback was taken and the library is not a dependency.
  - Sam's stated preference was `docs-markdown` "if well supported". It is not: its last
    release was April 2020.
- Supported content: headings, paragraphs, bold, italic, strikethrough, links, bulleted and
  numbered lists, soft line breaks, images, date chips (shown as their text), people chips
  (shown as the name, no link), and file/link chips (shown as a link). The site applies its
  own fonts, colours, sizes and spacing; the doc's are ignored. Doc "Heading 1" renders as
  the page's second-level heading, so each page keeps a single top heading from the site.
- Only the first tab of a doc is the page. Other tabs are neither shown nor checked. (Ruled
  in build.)
- A link that is not a normal web, email or phone link never reaches the page, whatever it
  was attached to, images included. (Ruled in build.)
- Images: the image addresses the Docs API returns expire within minutes to hours. They must
  not be used directly in pages. (Builder: how to serve them durably at no cost.)

## 10. Checks and comments

**Blocking** (page is not updated; comment posted on the doc)

- Empty body.
- Announcement with a blank or default title ("Untitled document").
- Content the site cannot show but that carries meaning: tables, drawings, charts,
  equations, footnotes, embedded objects other than images. (My call: block, do not drop
  silently, because dropping changes what the page says.)
- An image set to wrap text (a floating image). The comment tells the editor to set it to
  "In line". (Ruled in build: the converter cannot place these, and dropping one silently
  changes the page.)
- An image that is definitely broken: Google answers "not found" or similar for it. A
  temporary failure fetching an image (timeout, server error, rate limit) is not a problem
  with the doc: it is treated like Google being unreachable, so the last good page stays and
  no comment is posted. (Ruled in build.)
- A link that is not a well-formed web, email or phone link. Links are checked for form
  only, not for whether the destination is up. (My call.)

**Non-blocking** (ignored, no comment)

- Fonts, colours, sizes, alignment, spacing, page breaks, headers and footers, page setup.

**Comments**

- Posted by the service account through the Drive API, in plain language, saying what is
  wrong and what to do, and quoting the offending text so the editor can find it. Google
  Docs does not honour comment positions set through the API, so comments cannot be pinned
  to the spot.
- Every comment starts `Website: ` and ends "The website won't show this change until it's
  fixed." (Ruled in build; the wording must also be true for an announcement that has never
  been published.)
- One open comment per problem. Do not post the same comment again on every regeneration.
  Two regenerations running at the same moment can each post one; that is accepted.
- When the doc passes, the site resolves its own earlier comments.
- The site has no database. The doc's own comment list is the record of what has been
  reported. (My call.)

**Scope of a block**

- A blocked page doc holds back only that page.
- A blocked announcement doc is left out of the home slice and news page, or, if it was
  already published, stays at its last good version. Other announcements are unaffected.
  (Builder: with no database, "last good version of one announcement" may be hard; leaving
  a blocked announcement at its last cached rendering is acceptable, and so is omitting it
  until fixed. Do not let one bad announcement blank the list.)

**Every deploy**

- A new deploy starts with no cached pages, so there is no last good version to fall back
  on. Treat every deploy, not only the first, this way: a blocked page doc, or Google being
  unreachable, fails the build with a message naming the doc, and the previous deploy stays
  live. Deploys are rare and done by Sam, who can fix the doc or wait; this avoids needing
  a store of last-good content, which the no-database rule excludes. (My call.)
- Provide a command Sam can run before deploying that reports every doc currently blocked.
  (My call.)

## 11. Constraints

- Next.js, App Router, the version already used in the prototype (16.x). Its docs ship in
  `node_modules/next/dist/docs/`; read the relevant guide before writing code, since this
  version differs from older ones.
- The prototype's `cacheComponents` setting is turned off. (My call, made while planning:
  the keep-the-last-good-page guarantee in section 9 is documented only for sites without
  it. The build's first task proves the guarantee with a trial before anything depends on
  it.)
- No database and no paid service.
- Google API calls must stay comfortably inside free quotas at a two-minute interval across
  roughly ten pages. (Builder: confirm; it should be far inside them.)
- Secrets only in host settings.

## 12. Left to the builder

- Project layout, data-fetching structure, caching tags, component breakdown.
- Stable addresses for announcement pages.
- Serving Drive PDFs and Docs images without public sharing and without expiring links.
- How far ahead the Events page lists.
- Exact wording of comments.
- Tests. At minimum: the home slice rule against the table in section 6, and the checker
  and converter against saved Docs API responses covering each blocking and non-blocking
  case.

## 13. Unverified, to settle with a short trial at the start of the build

Status at 2026-11-16: none of the three below has been run, because no Google test account
exists yet. Settled so far: the keep-the-last-good-page behaviour was proven locally (a
failed regeneration kept serving the old page; a throwing page failed the build). Not yet
proven on the real host. Added during the build, also waiting on a live account: whether
Drive returns a comment's text exactly as posted (the no-duplicates rule depends on it),
whether large PDFs stream within the host's response limits, and three details of the Docs
data format (date chips, list markers, soft line breaks).

1. **Do editors get an email when the service account comments?** The whole "tell the
   editor" path assumes Google notifies people on the doc. Not confirmed for comments
   posted by a service account. If they are not notified, a blocked doc is only noticed
   when someone opens it. That outcome is acceptable for this project: what Sam asked for
   is a comment on the doc, and that is delivered either way. Do not build an email notice
   here; it would need a sending service and its own record of what was sent. Revisit it
   in the mailing-list project, which brings an email service with it. (My call.)
2. **Converter quality on real docs.** Run the chosen library over the actual About and FAQ
   content pasted into Docs before committing to it.
3. **Service account access to a folder and calendar owned by board@sawhoa.com**, if that
   account sits in a Google Workspace with sharing restrictions. The test account cannot
   answer this; it is settled only when the real account is set up, which should happen
   well before going live.

## 14. Relationship to the prototype

A Next.js prototype exists (now the root of this repository). Its look is the agreed direction: sunset
header photo, slate-blue menu bar, red links and buttons, Oswald capitalised headings,
single content column with a sidebar.

**Decided:** the real build starts from the prototype's code. Its pages, layout and styling
stay; its stand-in content file (`content/site.ts`) is what the Google sources replace. The
prototype was written quickly and has no tests, so the builder should expect to tidy it and
add the tests in section 12, and is free to restructure where the caching design needs it.
The sidebar's email sign-up form stays inert until the mailing-list project.
