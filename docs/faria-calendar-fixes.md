# Faria Calendar — Code Fixes for AI Studio (prioritized)

> Paste **the box below** into AI Studio (the workspace that has this app). It's a precise change
> request based on a code review of the generated app. Apply in order; P0 is a real security fix.

---

```
Apply these fixes to the Faria Calendar app. Implement each exactly, then report
the files changed. Keep all existing features working.

=== P0 — SECURITY: remove the hardcoded secret; separate the encryption key ===
Problem: server.ts (~line 42) and server-db.ts (~line 6) both do
  process.env.JWT_SECRET || "faria-calendar-super-secret-key-12345"
This public default is used for BOTH JWT signing AND AES token encryption. If the
env var isn't set, sessions are forgeable and stored refresh tokens are decryptable
by anyone.
Fix:
1. JWT_SECRET must be REQUIRED. At server startup, if process.env.JWT_SECRET is
   missing OR equals "faria-calendar-super-secret-key-12345", throw and refuse to
   start with a clear error. Remove the "|| ..." fallback everywhere.
2. Add a SEPARATE secret TOKEN_ENCRYPTION_KEY (min 32 chars) used ONLY by the
   AES-256 token encryption in server-db.ts. Do NOT reuse JWT_SECRET for encryption.
   Require it at startup too.
3. Add a startup env-validation function that checks all required vars
   (JWT_SECRET, TOKEN_ENCRYPTION_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
   APP_URL) and exits with a helpful message if any are missing.
4. Update .env.example: remove the real default value, add TOKEN_ENCRYPTION_KEY,
   and include a generate command comment:
   #   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

=== P1 — CONFIG/PRIVACY: stop hardcoding company specifics ===
1. Domain restriction (server.ts ~line 257): replace the hardcoded
   "vimal.desouza@fariaedu.com" / "fariaedu.com" logic with an env var
   ALLOWED_DOMAIN (e.g. "fariaedu.com"). Allow any "@${ALLOWED_DOMAIN}" address;
   no special-cased personal email. If ALLOWED_DOMAIN is empty, allow all (dev).
2. Mock-demo label (src/App.tsx ~line 346): remove the hardcoded personal email
   from the UI text; make it generic ("Explore demo with sample data").
3. Seed roster (server-db.ts ~line 86+): keep the seed for first-run, but use
   generic example addresses (e.g. @example.com) OR load the roster from config/
   the Google People directory instead of hardcoded @fariaedu.com emails.
4. PeopleSelector placeholder (~line 484): use a generic placeholder email.

=== P2 — CLEANUP: remove the duplicate timezone-math ===
There are two copies: ./timezone-math.ts (root) and ./src/timezone-math.ts, and
they differ. Keep ONE (src/timezone-math.ts), update server.ts to import from it,
and delete the root duplicate so the logic can't drift.

=== P3 — SCALE (before team rollout; can defer for pilot): real database ===
Persistence is a flat db.json file (server-db.ts) with no locking — unsafe for
200–300 concurrent users.
1. Refactor server-db.ts behind a small Storage interface (getUser, saveUser,
   getPrefs, savePrefs, getRoster, ...). Keep the current file implementation as
   "FileStorage" for local dev.
2. Add a "PostgresStorage" (or Cloud SQL) implementation behind the same interface,
   selected by an env var DB_BACKEND=file|postgres and DATABASE_URL.
3. Until Postgres is enabled, at least make file writes ATOMIC (write to a temp
   file then rename) to reduce corruption under concurrency.

=== P4 — ROBUSTNESS (nice to have) ===
1. Add basic rate limiting on the API routes.
2. Ensure calendar API failures degrade gracefully (they already fall back to
   mock) and log clearly; never leave the UI in a silent error state.
3. Add a /healthz endpoint.

=== ACCEPTANCE ===
- App refuses to start if JWT_SECRET / TOKEN_ENCRYPTION_KEY are missing or default.
- JWT signing and token encryption use DIFFERENT secrets.
- No hardcoded company email/domain in code; ALLOWED_DOMAIN drives access.
- Only one timezone-math file; server imports it.
- (P3) Storage is swappable; Postgres path exists; file writes are atomic.
- All existing screens, the Gantt, heatmap, and availability logic still work.
```

---

## Why these (from the code review)
| Fix | Evidence in code | Risk if ignored |
|---|---|---|
| **P0** secrets | `server.ts:42`, `server-db.ts:6` share `… \|\| "faria-calendar-super-secret-key-12345"` | Forgeable sessions; decryptable stored tokens |
| **P1** company data | `@fariaedu.com` in `server-db.ts`, `App.tsx:346`, `server.ts:257` | Leaks company specifics; brittle access control |
| **P2** duplicate file | `./timezone-math.ts` vs `./src/timezone-math.ts` differ | Logic drift / inconsistent behavior |
| **P3** flat file | `server-db.ts` uses `db.json` | Data corruption / no scale for 200–300 users |
| **P4** robustness | — | Ops resilience |

**Do P0 first.** P1–P2 are quick. P3 (Postgres) can wait until you move toward a team rollout, but it's required before 200–300 users.
