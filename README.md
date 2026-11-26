# Trifold Global: stock, sales and accounts

Stock management for Trifold Limited: track products and quantities at each
location, record stock coming in, going out, and moving between sites, and
control who can do what.

## Features

Built for Trifold Global (Distribution Solutions), Ibadan: a distributor of Dangote and Lafarge cement with a depot and retail outlets. Invoices, receipts and statements use Trifold Global's letterhead (logo in `public/`, business details in Settings).

- **Sales**: sell from the depot or an outlet at retail or wholesale prices. Prices include the VAT charged by Lafarge and Dangote. Trifold isn't VAT-registered, so the system doesn't split out or file VAT; invoices just carry a "prices include VAT" note. **Bank transfer** is the default payment. Sales can be paid in full, part-paid or put on credit for a named customer.
- **Discounts**: only people with the *give discounts* responsibility (management) see the discount box.
- **Invoices and receipts**: a printable A4 invoice with Trifold's details and bank account, plus a narrow till receipt for 80 mm counter printers.
- **Pack sizes**: e.g. *Trailer = 600 bags*, with their own prices. Stock is always counted in bags.
- **Customers and suppliers**, with balances owed both ways and **opening balances** for money owed before the system started.
- **Purchase orders** from Dangote and Lafarge: receive deliveries in parts, pay in advance or after, and the product cost updates automatically.
- **Locations and stock movements**: receive, issue, transfer between depot and outlets, and adjust after a count. Stock can never go negative.
- **Expenses, rebates and other money**: running costs (truck hire, loading, diesel, salaries and so on), **rebates from Lafarge/Dangote** (recorded by the MD when paid into the bank), other income, and owner capital and drawings.
- **Reports**:
  - **Daily report**: sales, money received, credit given, bags sold, sales by product, rep and location, plus a **stock report** per location (opening, delivered, transfers in and out, sold, other, closing).
  - **Sales and stock by period**, with Excel (CSV) downloads.
  - **Monthly income statement**: sales less discounts, cost of cement sold, rebates, expenses and net profit.
  - **Monthly balance sheet**: cash and bank, stock, money owed both ways and owner's equity. Trifold hires its trucks and has no loans, so there are no fixed assets or borrowings.
- **Staff and responsibilities**: the admin ticks what each person may do and which outlet(s) they work at. Presets:

  | Preset | Typical access |
  |---|---|
  | Owner | Everything, including financial statements, staff and settings |
  | Systems admin | Staff accounts, locations, products and settings |
  | General manager | Overall view of sales, stock, buying, discounts and daily/period reports. No income statement or balance sheet |
  | Outlet manager | Tied to their outlet: sales, discounts, deliveries, stock and that outlet's reports |
  | Sales rep / marketer | Sales, payments and customers. Sees only their own sales |

  Menus only show what each person can use. Anyone tied to an outlet only sells, moves stock and sees reports for that outlet.
- All times are shown in Lagos time and amounts in naira. Money is stored as whole kobo, so totals never suffer rounding errors.

## Tech stack

Next.js 16 (App Router, Server Actions), React 19, TypeScript, Prisma 6 and PostgreSQL
(Supabase in production). Tests use Vitest against a real Postgres database.
Production runs on cPanel's "Setup Node.js App". See **[DEPLOY-CPANEL.md](DEPLOY-CPANEL.md)**.

## Getting started (development)

Requires Node.js 20.9 or later and a local PostgreSQL server.

```bash
# One-off: create a database user and two databases (development and tests)
sudo -u postgres psql -c "CREATE ROLE trifold LOGIN PASSWORD 'trifold' CREATEDB;"
sudo -u postgres createdb -O trifold trifold_dev
sudo -u postgres createdb -O trifold trifold_test

npm install
cp .env.example .env        # points at the databases above
npm run db:deploy           # create the tables
npm run db:seed             # owner account + sample cement data
npm run dev                 # http://localhost:3000
```

Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env` (default
`admin@trifold.local` / `ChangeMe123!`). The seed adds sample cement data (Dangote and Lafarge
products, a depot, two outlets, deliveries, sales and expenses) and one demo account per role:
`gm@`, `sysadmin@`, `ikeja@`, `lekki@` and `rep@trifold.local`, all with the same password.
**For real use, set `SEED_DEMO_DATA="false"`** so only the owner account is created.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Make a production build and serve it |
| `npm test` | Run the tests. **Wipes and rebuilds `TEST_DATABASE_URL`**, which must name a database containing "test" |
| `npm run typecheck` | Check types with TypeScript |
| `npm run db:migrate` | Create a migration after changing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply migrations to the database in `DATABASE_URL` / `DIRECT_URL` |
| `npm run db:seed` | Create the owner account (and demo data unless `SEED_DEMO_DATA="false"`) |
| `npm run package:cpanel` | Build `dist/trifold-cpanel.zip` for uploading to cPanel |

GitHub Actions runs **"Build cPanel package"** on every push to `main`: it tests the app and attaches
the zip to the run. No secrets are stored in GitHub: on the server, `node setup-database.js` (included
in the package) applies migrations and creates the owner account, using the connection string set in
cPanel or pasted in for that run only.

## Project layout

```
app/
  login/                 Sign-in page
  (app)/                 Signed-in area (layout checks the session)
    page.tsx             Dashboard
    sales/ customers/ products/ movements/ locations/
    purchases/ suppliers/ reports/ users/ settings/ account/
  api/export/[report]/   CSV downloads
components/              Shared UI (forms, tables, badges)
lib/
  stock.ts               Movement rules and stock-level updates (transactional)
  sales.ts               Sales, customer payments and cancellations
  purchasing.ts          Purchase orders, receiving and supplier payments
  reports.ts, csv.ts     Report queries and CSV export
  daily.ts, financials.ts  Daily report, income statement and balance sheet
  scope.ts               Outlet and own-sales restrictions
  auth.ts                Sessions (hashed tokens in the DB, httpOnly cookie) and passwords
  permissions.ts         Roles and permission checks
  actions/               Server actions for each area
prisma/                  Schema, migrations, seed
scripts/package-cpanel.sh  Builds the cPanel upload
scripts/setup-database.js  Database setup command run from the cPanel Terminal
.github/workflows/       Builds and tests the cPanel package
tests/                   Vitest tests
```

## Production notes

- **Hosting**: cPanel "Setup Node.js App" runs `server.js` from the package; data is in Supabase.
  Step-by-step instructions: [DEPLOY-CPANEL.md](DEPLOY-CPANEL.md).
- **Database connections**: `DATABASE_URL` is Supabase's transaction pooler (port 6543, with
  `?pgbouncer=true&connection_limit=5`); `DIRECT_URL` is the session pooler (port 5432), used for migrations.
- **HTTPS**: the session cookie is marked `Secure` in production, so serve the app over HTTPS (cPanel AutoSSL).
- **Currency**: amounts are shown in naira (NGN). Set `NEXT_PUBLIC_CURRENCY` before building to change it.
- **Time zone**: everything is shown in Lagos time whatever the server's clock is set to.
