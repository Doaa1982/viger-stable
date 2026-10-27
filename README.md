# Viger Stable — first version

An all-in-one equestrian platform for Egypt, with AI built into every module. It covers what Horsebook offers (yard management, horse profiles, marketplace, breeding, community, professionals and jobs) and adds AI on top.

Prices are in **Egyptian pounds (EGP)**. The interface is in English.

---

## Quick start (Mac)

You need **Node.js 20 or newer**. Check with `node -v`; install it from https://nodejs.org if needed.

```bash
cd viger-stable
npm install
cp .env.example .env        # then open .env and change AUTH_SECRET to a long random string
npm run setup               # creates the database and loads demo data
npm run dev
```

Open http://localhost:3000 and sign in with **demo@vigerstable.com / password123**.

### Demo accounts (password for all: `password123`)

| Email | Account type |
| --- | --- |
| demo@vigerstable.com | Stable (your brother's yard, full demo data) |
| rider@demo.com | Rider / owner |
| vet@demo.com | Professional – vet |
| farrier@demo.com | Professional – farrier |
| coach@demo.com | Professional – coach |
| fan@demo.com | Fan |

`npm run db:seed` resets everything back to the demo data.

---

## Turning on the AI

Without a key the app runs in **demo mode**: every AI feature still works, but gives sample, rule-based answers.

Use **either** provider (the app picks whichever key is in `.env`):

**Google Gemini (has a free tier)**
1. Go to https://aistudio.google.com/apikey and create a key.
2. In `.env`: `GEMINI_API_KEY="..."` (model: `GEMINI_MODEL`, default `gemini-3.8-flash`).

**Anthropic Claude**
1. Create a key at https://console.anthropic.com
2. In `.env`: `ANTHROPIC_API_KEY="sk-ant-..."` (model: `ANTHROPIC_MODEL`, default `claude-sonnet-5-5`).

Restart `npm run dev` after changing `.env`. The sidebar shows **"✦ AI connected"** and the AI Center page shows which model is used.

> Note on Gemini's free tier: Google may use free-tier prompts to improve its products, and free use is not allowed for apps serving users in the EU/UK. Move to a paid Gemini plan before real customers use the app.

---

## What's inside

Tags match the business plan: **Core** (same as Horsebook), **AI Enhancement** (a Horsebook feature made smarter), **AI Added Service** (new, Horsebook has nothing like it), **New Service** (new, not AI).

### Run the yard
| Feature | Tag | Where |
| --- | --- | --- |
| Dashboard with stats, today's tasks, health due, visits | Core | `/dashboard` |
| **AI daily briefing** – writes the morning plan | AI Enhancement | `/dashboard` |
| Tasks: priority, categories, recurring tasks, overdue, WhatsApp reminder to staff | Core | `/tasks` |
| Staff rota (Saturday–Friday week, night shifts), time clock, hours per week | Core | `/staff` |
| **AI rota builder** – fair week covering early feeds and late checks | AI Enhancement | `/staff` |
| Health Hub: records, due/overdue reminders, costs flow into Finance | Core | `/health` |
| **Smart Scan** – photo of a vet card / invoice (Arabic or English) becomes a record | AI Enhancement | `/health` |
| Feed board + feeding plans per horse | Core | `/feeding` |
| **AI feeding plans** – from weight, workload, Egyptian season, local feeds | AI Enhancement | `/feeding` |
| Yard board: stalls/paddocks, capacity, blocks pairing horses that don't get on | Core | `/yard-board` |
| **AI turnout groups** | AI Enhancement | `/yard-board` |
| Finance: income/expenses, by category and by horse, CSV export | Core | `/finance` |
| Branded invoices, print/PDF, send by WhatsApp or email, livery clients | Core | `/finance` |
| **AI finance insights** – review + next-month forecast | AI Enhancement | `/finance` |
| Breeding season board, expected foaling (340 days), auto foal profile, shared-ancestor warning | Core | `/breeding` |
| **AI Mating Advisor** – ranks stallions for a mare | AI Added Service | `/breeding` |

### Horses & marketplace
| Feature | Tag | Where |
| --- | --- | --- |
| Horse profiles, photos, pedigree, FEI ID | Core | `/horses` |
| **Passport scan** – fills the profile from passport photos | AI Enhancement | `/horses/new` |
| **AI Health Early-Warning** | AI Added Service | each horse |
| **AI Symptom Triage** – how urgent is it, what to do until the vet arrives | AI Added Service | each horse |
| **AI Horse Valuation** – price range in EGP + suggested budget stars | AI Added Service | each horse |
| **AI Listing Writer** | AI Added Service | each horse |
| **AI Ride & Gait Analysis** – from photos / video frames | AI Added Service | each horse |
| **AI Training Planner** | AI Added Service | each horse |
| Sell / lease, hidden price with budget stars, trial slots | Core | each horse |
| Marketplace with filters | Core | `/marketplace` |
| **AI search** – "calm gelding for an amateur under 1.5 million" | AI Enhancement | `/marketplace` |
| Trial requests: approve/decline, creates a task, notifies by message | Core | `/trials` |
| Saved horses in folders with private notes | Core | `/saved` |

### Community & professionals
| Feature | Tag | Where |
| --- | --- | --- |
| The Arena feed: posts, tags, likes, comments, follow | Core | `/arena` |
| Direct messages with horse cards, seen/sent | Core | `/messages` |
| Professional profiles (vet, farrier, coach…), online booking | Core | `/professionals` |
| Pro diary: confirm, decline, suggest a new time | Core | `/bookings` |
| **Visit notes → health record + invoice + owner summary** | AI Enhancement | `/bookings` (pro account) |
| Jobs board, applications, shortlist/accept/decline | Core | `/jobs` |
| **AI applicant ranking** | AI Enhancement | `/jobs/[id]` |

### AI Yard Assistant (AI Added Service)
`/assistant` — a chat that can **read and change** yard data: list horses, tasks, health due, staff on shift, finance summary; create and complete tasks; log health events. Example: *"Layla's left fore is swollen again – log it and remind Saeed to cold hose her tomorrow at 10."*

`/ai` lists every AI feature with a link to it.

---

## Tech stack

- **Next.js 15** (App Router, server components, server actions) + **React 19** + **TypeScript**
- **Tailwind CSS** for styling
- **Drizzle ORM** + **SQLite/libSQL** (a local `dev.db` file; no database server needed)
- **Anthropic Claude API** for all AI features (`src/lib/ai/`)
- Login with email + password (bcrypt), sessions in a signed http-only cookie (jose)

## Project structure

```
src/
  app/
    page.tsx                 landing page
    (auth)/                  login, register
    (app)/                   everything behind login – one folder per module
      dashboard/ assistant/ ai/ tasks/ staff/ health/ feeding/ yard-board/
      finance/ breeding/ horses/ marketplace/ trials/ saved/
      arena/ messages/ professionals/ bookings/ jobs/ profile/
  components/                shared UI (cards, badges, AI panel, markdown)
  db/
    schema.ts                all tables
    seed.ts                  demo data
  lib/
    ai/client.ts             AI connection + demo mode switch
    ai/features.ts           every AI feature (valuation, triage, rota…)
    ai/assistant.ts          the Yard Assistant and its tools
    auth.ts                  login sessions
    uploads.ts               image uploads (saved to public/uploads)
```

Each module keeps its database changes in an `actions.ts` file next to its page.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start for development (http://localhost:3000) |
| `npm run build && npm start` | Production build and server |
| `npm run setup` | Create tables and load demo data |
| `npm run db:push` | Apply changes from `schema.ts` to the database |
| `npm run db:seed` | Reset to demo data (deletes all data) |
| `npm run db:studio` | Browse the database in your web browser |
| `npm run typecheck` | Check the TypeScript |

---

## Before going live

This is a first version for demos and the pilot at the stable. Before real customers use it:

1. **Database:** move to a hosted database (Turso works with no code changes: set `DATABASE_URL` and `DATABASE_AUTH_TOKEN`; or port `schema.ts` to Postgres).
2. **File uploads:** photos are saved in `public/uploads`. Move them to cloud storage (S3 / Cloudflare R2).
3. **Hosting:** Vercel, Railway or a VPS. Set `AUTH_SECRET` to a long random value.
4. **Security:** add password reset, email verification, rate limiting on login and AI routes.
5. **Payments:** connect an Egyptian payment provider (cards, mobile wallets, instalments) for subscriptions and marketplace escrow.
6. **Legal:** terms, privacy policy, and a clear "AI advice is not veterinary advice" notice (already shown in the app).

## Roadmap (from the business plan)

- **Phase 2:** WhatsApp Business bot for the assistant and reminders; secure payments and escrow; native iOS/Android apps; Arabic interface.
- **Phase 3:** video upload for gait analysis (not just frames), heat-cycle prediction, feed and supply inventory with auto-reorder, pro route planning.
- **Phase 4:** AI stable camera monitoring (foaling, cast horse, distress), transport, insurance and shop marketplace, expansion to the Gulf.
