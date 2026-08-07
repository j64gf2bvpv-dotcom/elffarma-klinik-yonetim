# shared/

DOM-free TypeScript shared between the desktop app (`src/`) and the mobile app
(`mobile/`): row/table types, the Turkish string dictionary, and pure business
logic helpers with no Supabase/React/DOM dependency.

These are **copies**, not symlinks or a workspace package (see
`/Users/erkankongul/.claude/plans/greedy-gathering-galaxy.md` §2b for why:
avoiding npm workspaces avoids Metro/React-version hoisting conflicts between
the Vite desktop app and the Expo mobile app). The desktop app's originals in
`src/types/database.ts`, `src/i18n/tr.ts`, `src/lib/paymentDue.ts`,
`src/lib/expiry.ts`, `src/lib/pctDelta.ts` are untouched and remain the ones
desktop actually imports — **when the schema or these helpers change, update
both copies.** Consolidating this into a single de-duplicated source (desktop
also importing from `shared/`) is a reasonable later cleanup, not done now to
avoid touching desktop's working import graph during the mobile build-out.
