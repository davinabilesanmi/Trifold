# Trifold Stock

Stock management for Trifold Limited: track products and quantities at each
location, record stock coming in, going out, and moving between sites, and
control who can do what.

## Features

- **Products**: SKU, category, unit, unit cost and a reorder level. Stock is flagged *Low* or *Out* across all locations.
- **Locations**: warehouses, shops or other sites, each with its own stock levels and value.
- **Stock movements**, each logged with who, when, a reference and a note:
  - **Receive**: stock arriving at a location (for example a supplier delivery)
  - **Issue**: stock leaving a location (sale, dispatch, write-off)
  - **Transfer**: from one location to another
  - **Adjust**: set a location's quantity to a physical count. The difference is recorded.
- **No negative stock.** Issues and transfers that would oversell are refused, even when several are recorded at the same time.
- **Dashboard**: total units, stock value at cost, items to reorder, and recent activity.
- **Users and roles**:

  | Role    | View stock | Record movements | Manage products and locations | Manage users |
  |---------|:---:|:---:|:---:|:---:|
  | Staff   | ✓ | ✓ |   |   |
  | Manager | ✓ | ✓ | ✓ |   |
  | Admin   | ✓ | ✓ | ✓ | ✓ |

- Products and locations are **archived** rather than deleted, so their history is kept.

## Tech stack

Next.js 16 (App Router, Server Actions), React 19, TypeScript, Prisma 6, and
SQLite for development. Tests use Vitest.

## Getting started

Requires Node.js 20 or later.

```bash
npm install
cp .env.example .env        # then edit the admin credentials
npx prisma migrate deploy   # create the database
npm run db:seed             # create the admin user and demo data
npm run dev                 # http://localhost:3000
```

Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env`. The default
is `admin@trifold.local` / `ChangeMe123!`. **Change it** on the *Your account* page.
Set `SEED_DEMO_DATA="false"` to skip the sample locations and products.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Make a production build and serve it |
| `npm test` | Run the unit tests (uses a separate `prisma/test.db`) |
| `npm run typecheck` | Check types with TypeScript |
| `npm run db:migrate` | Create a migration after changing `prisma/schema.prisma` |
| `npm run db:seed` | Seed the admin user (and optional demo data) |

## Project layout

```
app/
  login/                 Sign-in page
  (app)/                 Signed-in area (layout checks the session)
    page.tsx             Dashboard
    products/ locations/ movements/ users/ account/
components/              Shared UI (forms, tables, badges)
lib/
  stock.ts               Movement rules and stock-level updates (transactional)
  auth.ts                Sessions (hashed tokens in the DB, httpOnly cookie) and passwords
  permissions.ts         Roles and permission checks
  actions/               Server actions for each area
prisma/                  Schema, migrations, seed
tests/                   Vitest tests
```

## Production notes

- **Database**: SQLite is fine for a single server. For production, switch
  `provider` in `prisma/schema.prisma` to `"postgresql"`, set `DATABASE_URL`,
  regenerate the migrations, then run `npm run db:deploy`.
  With SQLite, keep `?connection_limit=1` in the URL. It makes concurrent stock
  movements queue instead of deadlocking.
- **HTTPS**: the session cookie is marked `Secure` in production, so serve the app over HTTPS.
- **Currency**: amounts are shown in naira (NGN) by default. Set `NEXT_PUBLIC_CURRENCY`
  (for example `USD`) before building to change it.
