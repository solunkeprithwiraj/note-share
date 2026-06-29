# NoteShare

A note-taking app where every note can be shared through a **secure, expiring link**. Links can be one-time or time-based, public or password-protected, and can be force-revoked at any time. View counts are tracked accurately and the one-time flow is safe under concurrent access.

**Live demo:** https://note-share-iota.vercel.app
**Test credentials:** `demo@noteshare.app` / `DemoPass123`

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Route Handlers) |
| Language | TypeScript |
| UI | React 19, shadcn/ui, Tailwind CSS v4 |
| ORM | Prisma 6 |
| Database | PostgreSQL (hosted on Neon) |
| Auth | JWT (`jsonwebtoken`) in an httpOnly cookie |
| Hashing | bcryptjs (passwords + access keys) |
| Tokens/keys | Node `crypto` CSPRNG |
| Hosting | Vercel |

The backend is built entirely with Next.js Route Handlers (Web-standard `Request`/`Response`) — no separate server. Auth is enforced in two layers: edge middleware gates `/notes/*` on cookie presence before render, and each API handler verifies the JWT signature server-side.

---

## Setup instructions

### Prerequisites
- Node.js 20+
- A PostgreSQL database (local Docker, or a free Neon project)

### 1. Install
```bash
git clone https://github.com/solunkeprithwiraj/note-share.git
cd note-share
npm install
```
`npm install` triggers `postinstall → prisma generate`, which builds the typed Prisma client.

### 2. Environment variables
Create `.env`:
```env
# Pooled connection — used by the app at runtime
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
# Direct connection — used by Prisma for migrations
DIRECT_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/neondb?sslmode=require"

# Secret used to sign JWTs (use a long random value in production)
JWT_SECRET="your-strong-random-secret"

# Base URL used to build share links
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### 3. Migrate + run
```bash
npx prisma migrate deploy   # apply schema to the database
npm run dev                 # start on http://localhost:3000
```

### Deployment notes (Vercel)
Set the same four env vars in the Vercel project. `NEXT_PUBLIC_BASE_URL` must be the full deployed origin including `https://`, because it is baked in at build time — change it and redeploy.

---

## Database schema

Three models. A user owns many notes; a note has many share links. Deleting a note cascades to its links.

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String                       // bcrypt hash
  notes     Note[]
  createdAt DateTime @default(now())
}

model Note {
  id         String      @id @default(cuid())
  userId     String
  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  title      String
  content    String
  shareLinks ShareLink[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}

model ShareLink {
  id           String     @id @default(cuid())
  noteId       String
  note         Note       @relation(fields: [noteId], references: [id], onDelete: Cascade)
  token        String     @unique          // CSPRNG, used in the URL
  shareType    ShareType                   // ONE_TIME | TIME_BASED
  accessType   AccessType                  // PUBLIC  | PASSWORD_PROTECTED
  passwordHash String?                     // bcrypt hash of the access key (null if PUBLIC)
  expiresAt    DateTime?                   // set only for TIME_BASED
  usedAt       DateTime?                   // set on first successful ONE_TIME view
  isRevoked    Boolean    @default(false)
  viewCount    Int        @default(0)
  createdAt    DateTime   @default(now())
}

enum ShareType   { ONE_TIME  TIME_BASED }
enum AccessType  { PUBLIC    PASSWORD_PROTECTED }
```

**Security note:** the plaintext access key is **never stored** — only its bcrypt hash. The key is shown to the owner exactly once, at creation time.

---

## Share link flow

### Creating a link — `POST /api/notes/[id]/share`
1. Authenticate the caller and confirm they own the note.
2. Validate `shareType` and `accessType`. For `TIME_BASED`, require a valid **future** `expiresAt`.
3. Generate a random `token` (CSPRNG).
4. If `PASSWORD_PROTECTED`, generate a random access key, hash it with bcrypt, and store only the hash.
5. Persist the `ShareLink` and return `{ url, accessKey }`. `accessKey` is returned **once** and never again.

### Opening a link — `POST /api/share/[token]`
Checks run in this order, each short-circuiting:
1. Link not found → `404`.
2. Revoked → `410`.
3. Time-based and past `expiresAt` → `410`.
4. One-time and already used → `410`.
5. Password-protected → rate-limit the attempt, then verify the supplied key against the stored hash (`401` on mismatch).
6. Reveal the note and update the view count (see below).

A separate `GET /api/share/[token]` returns only metadata (`accessType`, `shareType`, `status`) with **no side effects**, so the share page can decide whether to prompt for a password before any view is counted.

---

## Password / key generation logic

- On creating a `PASSWORD_PROTECTED` link, the access key is `crypto.randomBytes(6).toString("hex")` — a 12-character hex string from a cryptographically secure RNG (the "dynamic password/key").
- It is hashed with bcrypt (`hashPassword`) and only the hash is stored in `passwordHash`.
- The plaintext key is returned to the owner **once** in the creation response and shown a single time in the UI.
- On unlock, the visitor's input is compared with `bcrypt.compare`. The server never stores or logs the plaintext.

The share `token` itself is independent: `crypto.randomBytes(32).toString("base64url")` — 256 bits of entropy, unguessable, so the URL alone cannot be brute-forced.

---

## Expiry logic

Two independent kinds of expiry:

- **One-time (`ONE_TIME`)** — expires by *use*. After the first successful view, `usedAt` is set and any later open returns `410`.
- **Time-based (`TIME_BASED`)** — expires by the *clock*. `expiresAt` is validated to be in the future at creation. On every open, the server compares `expiresAt <= now()`; once past, it returns `410`.

Expiry is always evaluated **server-side** against the database row, never trusted from the client.

---

## Invalidate / revoke logic

`POST /api/share/[token]/revoke` (owner-only):
- Confirms the caller owns the note behind the link.
- Sets `isRevoked = true`.

Revocation is checked first in the open flow, so a revoked link immediately returns `410` regardless of its type, remaining time, or password. It is a hard kill switch the owner can pull at any moment.

---

## View count logic

`viewCount` is meant to reflect **successful reveals only**:

| Event | Counted? |
|---|---|
| Public view succeeds | **+1** |
| Password unlock succeeds | **+1** |
| Wrong password | no |
| Expired / revoked / already-used | no |

This falls out of ordering: all rejection paths (`404/410/401/429`) return **before** the count is touched. The increment is the same database write that reveals the note, so the count moves only when a view actually happens.

- **One-time:** the increment is part of the atomic consume (below), so it can only ever go from 0 → 1.
- **Time-based:** `update(... viewCount: { increment: 1 })` — an atomic DB-side increment (not read-modify-write), so concurrent views can't lose updates.

---

## Race-condition handling

The dangerous case is two people opening the **same one-time link at the same time**. Both could pass the "is it used?" read before either writes, and both could see the note.

The fix is a single **atomic conditional update** instead of read-then-write:

```ts
const result = await prisma.shareLink.updateMany({
  where: { token, usedAt: null, isRevoked: false },
  data:  { usedAt: new Date(), viewCount: { increment: 1 } },
});
if (result.count === 0) {
  // someone else consumed it first — we lost the race
  return Response.json({ error: "Link already used" }, { status: 410 });
}
```

The database evaluates `usedAt IS NULL` and writes in one atomic statement. Exactly one concurrent request matches a row (`count === 1`) and sees the note; every other request matches zero rows (`count === 0`) and is rejected. The view count is incremented inside the same statement, so it is consistent with who actually got access.

This was verified by firing 30 simultaneous requests at one link: exactly **1** returned the note, **29** returned `410`, and the stored `viewCount` was exactly **1**.

---

## Brief answers

### 1. How do you prevent two users from using a one-time link at the same time?
With one atomic conditional write rather than a read followed by a write. `updateMany({ where: { token, usedAt: null }, data: { usedAt: now } })` lets the database decide the winner: it matches the row for exactly one request (`count === 1`), and every other concurrent request matches nothing (`count === 0`) and gets a `410`. No application-level lock is needed because the atomicity is enforced by the row update itself.

### 2. How do you update the view count safely?
Two safeguards. First, ordering: every failure path returns before the count is touched, so only successful reveals increment. Second, the increment is an atomic DB operation — `{ increment: 1 }` for time-based links, and part of the same atomic `updateMany` for one-time links — so it is never a read-modify-write and can't lose concurrent updates.

### 3. How would this work if 1 million people opened the link?
The correctness model already holds at scale: the one-time guarantee is a single atomic row update, so exactly one of a million concurrent requests wins and the rest get `410` — no contention bug, just one short row-level lock. To handle the *load*, I'd: serve reads from a cache/CDN and connection-pool the database (Neon already gives a pooled endpoint); move the in-memory rate limiter to Redis so limits are shared across instances; and, if a single hot row became a write bottleneck, batch or buffer view-count increments (e.g. increment in Redis and flush periodically) instead of writing on every hit. The schema and the atomic-update pattern don't change.

### 4. How would you prevent brute-force attempts on password-protected links?
Several layers. The access key is from a CSPRNG and bcrypt-hashed, so guessing is expensive and offline cracking is hard. On the unlock endpoint there's a sliding-window rate limiter keyed by `token:ip` (5 attempts per 15 minutes) that returns `429` once exceeded. bcrypt's cost factor also makes each attempt deliberately slow. In production I'd move the limiter to Redis (shared across serverless instances), and could add exponential backoff, a CAPTCHA after repeated failures, and per-account/global anomaly alerts.

---

## Project structure

```
app/
  api/
    auth/{register,login,logout}/route.ts   JWT auth
    notes/route.ts                          create a note
    notes/[id]/route.ts                     load a note (+ its links)
    notes/[id]/share/route.ts               create a share link
    share/[token]/route.ts                  open a link (GET meta, POST access)
    share/[token]/revoke/route.ts           force-revoke
  login/ register/ notes/new/ notes/[id]/ share/[token]/   pages
lib/
  auth.ts        hashing, JWT sign/verify, getCurrentUser
  prisma.ts      Prisma client singleton
  rateLimit.ts   sliding-window limiter
middleware.ts    edge auth gate for /notes/*
prisma/schema.prisma
```
