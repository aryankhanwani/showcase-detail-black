# AURUM Detail Studio

A marketing site for a **fictional** car detailing studio in Ahmedabad, built as
a showcase. The studio, its address, its pricing and its contact details are
invented — the footer says so on every page.

Seven routes, a video hero, and a contact form that turns into a chat with an
AI receptionist that already knows what you typed.

---

## Stack

| Piece      | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack), React 19              |
| Styling    | Tailwind v4, tokens in `src/app/globals.css`              |
| Motion     | Framer Motion (`motion`) — transform/opacity only         |
| Database   | Postgres 16 in Docker, Prisma 7 with the `pg` adapter     |
| AI         | DeepSeek (`deepseek-chat`) over its OpenAI-compatible API |
| Validation | Zod                                                        |

## Running it

```bash
docker compose up -d          # Postgres on :5433
cp .env.example .env.local    # then fill in DEEPSEEK_API_KEY
bun run db:push               # create the tables
bun run dev                   # http://localhost:3000
```

`SESSION_SECRET` must be set — generate one with `openssl rand -base64 32`.
Without `DEEPSEEK_API_KEY` every page still works; only the chat returns a clear
"not configured" message.

### Scripts

| Command               | Does                                     |
| --------------------- | ---------------------------------------- |
| `bun run dev`         | Dev server                               |
| `bun run build`       | Production build                         |
| `bun run db:up`       | Start Postgres                           |
| `bun run db:push`     | Push the schema                          |
| `bun run db:studio`   | Prisma Studio                            |
| `bun run db:reset`    | Drop and recreate every table            |

---

## Deploying

Vercel works. Two things break a first attempt, and neither is obvious:

**1. The Prisma client is generated code and is gitignored.** A clean checkout
has nothing at `src/generated/prisma`, so the build dies on
`Module not found: Can't resolve '@/generated/prisma/client'`. Fixed here by
running `prisma generate` in both `build` and `postinstall` — don't "tidy" it
away.

**2. `DATABASE_URL` cannot point at local Docker.** The deployed app is not on
your laptop's network, so `localhost:5433` is unreachable. You need a hosted
Postgres.

### Vercel + Neon (both free)

```bash
# 1. Create a Postgres at neon.tech, copy the POOLED connection string
#    (the hostname contains `-pooler`).

# 2. Push the schema to it, once, from your machine:
DATABASE_URL="<neon-direct-url>" bun run db:push

# 3. Deploy
vercel

# 4. Set env vars on the project (or paste them in the dashboard):
vercel env add DATABASE_URL production      # the POOLED url
vercel env add DEEPSEEK_API_KEY production
vercel env add SESSION_SECRET production    # openssl rand -base64 32
vercel --prod
```

Use the **pooled** URL for `DATABASE_URL` and the **direct** URL only for
`db:push`. Every warm lambda keeps its own pool, so `src/lib/db.ts` drops to
one connection each when `VERCEL` is set and lets Neon's pooler multiplex.

`maxDuration = 60` on `/api/chat` matters: a streamed reply holds the
connection open for the whole generation, and the 10s default would cut it off
mid-sentence.

### Anywhere with a real server

Railway, Render or Fly are simpler if you would rather not think about
connection pooling — they run the app as one long-lived process next to a
Postgres, so the default pool of 10 is correct and nothing above applies except
setting the three env vars.

### On your phone, without deploying

`bun run dev` already binds to your LAN and prints the address:

```
- Local:         http://localhost:3000
- Network:       http://192.168.1.5:3000   <- open this on the phone
```

Use that Network line rather than guessing the interface — it is `en1` on this
machine and `en0` on plenty of others, so `ipconfig getifaddr en0` often just
returns nothing.

Everything works over LAN including the video and the chat API. The session
cookie is not `secure` in development, so it survives plain HTTP; in production
it is secure-only, which is why this trick is dev-only.

---

## The two things worth reading the code for

### 1. The form becomes the chat

`src/components/contact/` is one panel with two states.

`ContactPanel` is a `layout` element, so its height animates between the form's
and the chat's. The two states swap inside it with `AnimatePresence mode="wait"`
— the form is fully gone before the chat measures, which is what stops the
height jumping mid-crossfade. Children animate `layout="position"` rather than
plain `layout`, because a layout animation that scales a box also scales the
text inside it, and stretching text is exactly what reads as cheap.

When the chat opens it already holds the enquiry. The chips along the top are
the same values that went into the system prompt, so what the customer can see
and what the model knows are the same data by construction — the assistant never
asks for the car it was just told about.

### 2. Returning enquiries

A customer is matched on **phone or email**, both normalised — `+91 98250 41200`
and `9825041200` are the same person, which is the whole reason the feature
fires at all.

When there is a prior enquiry the conversation opens with a message written in
`returningPrompt()` rather than generated, because "do you want to continue?"
must be identical every time and must not be something the model can hallucinate
around. The customer picks, and `/api/chat/resume` either links the new
conversation to the old one (`resumedFromId`) and replays its transcript, or
starts clean.

Choosing "carry on" does **not** move the customer back into the old thread. The
new enquiry stays the live record — so what they just filled in is never silently
discarded — while the model still receives the full history.

---

## Security

- **Conversation ids are not capabilities.** A cuid is not a secret, so the
  browser carries an HMAC-signed, `httpOnly` cookie naming exactly which
  conversations it may touch. Every chat route checks it, and the signature is
  compared in constant time.
- **Authorisation is checked before configuration**, so an unauthenticated
  caller cannot learn whether an AI key is configured.
- **The resume target comes from the cookie, never the request body** — you
  cannot resume into someone else's thread by supplying its id.
- `/api/enquiry` and `/api/chat` are rate limited per IP (in-process; on more
  than one instance this wants a shared store).

## The AI receptionist

`src/content/knowledge.md` is the entire world the assistant is allowed to speak
from — services, price bands, the studio's actual arguments, and the rules it
cannot break (never quote a single price, never invent an offer, never promise a
date, escalate complaints rather than defend). It is markdown on disk rather
than a string constant so the studio's facts can be edited without touching
TypeScript, and it is read once per server process.

`src/content/studio.ts` holds the same facts as data for the UI. **When a price
changes in one, change it in the other** — they are read by different audiences
and must never disagree.

---

## Design

One ground, tonal separation, and gold as punctuation.

- **The page has one background.** `.ground` is rendered once in the layout —
  a light anchored to the document (it scrolls away with the screen it lights)
  and a grain anchored to the viewport (film sits on the lens, not the subject).
  Sections never carry a fill; they separate by rhythm.
- **Elevation is luminance, not shadow.** A dark drop shadow on a dark canvas is
  invisible, so `surface-1/2/3` step the paper tint instead. A card is a surface
  token and a radius — never a border.
- **Gold is structural.** It marks the active state, the status dot, a section
  rule, a reference chip. It is never a fill and never a gradient; the moment it
  becomes one the site looks cheap.
- **Type**: Sora for display (it keeps structure past 4rem, where a UI face goes
  flat), Inter for body (most legible thing available at 16–17px on a mid-range
  Android). Mono is a system stack — no webfont for thirty glyphs.
- **Motion animates transform and opacity only**, everything is `once: true`,
  and `prefers-reduced-motion` resolves to the *visible* state, never to hidden.

## Media

Every image is a frame pulled from the same body of studio footage, which is
deliberate — six unrelated stock photographs read as six different businesses.
Clips are from [Mixkit](https://mixkit.co) under its free licence (commercial
use, no attribution required). Total media weight is ~1.6 MB; the hero is
361 KB h264 / 168 KB vp9 at 720p, and is never loaded at all under reduced
motion — the poster is the hero.

Swap them by replacing files in `public/media/`; the paths are mapped in
`src/content/media.ts`.
