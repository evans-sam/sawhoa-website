# SAWHOA website

Start here: `docs/superpowers/STATUS.md` says what is built, what is blocked, and what to do
next. The design and plan it points to are the source of truth for behaviour.

- Next.js 16 has breaking changes from older versions. Follow `AGENTS.md`: read the relevant
  guide in `node_modules/next/dist/docs/` before writing page, route or caching code.
- `cacheComponents` stays off and no `error.tsx` is added; STATUS.md explains why.
- Checks before any commit: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- The Google key lives only in `.env.local` as `GOOGLE_SERVICE_ACCOUNT_KEY_B64`. Never
  print it, commit it, or ask for it in chat.
- No attribution lines in commit messages or pull request descriptions.
- Explain things to Sam in plain language; the board members who will use the site are not
  technical.
