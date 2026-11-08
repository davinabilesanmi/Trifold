# Trifold Stock

Stock management for Trifold Limited: track products and quantities at each
location, record stock coming in, going out, and moving between sites, and
control who can do what.

## Features

- **Sales and invoices**: sell from any location at retail or wholesale prices. Each sale gets an invoice number (INV-000001) and a printable invoice with Trifold's details and bank account.
- **Credit and payments**: sales can be paid in full, part-paid or on credit (credit needs a named customer). Take later payments against an invoice and see who owes what. Cancelling a sale returns the stock and records a refund.
- **Customers**: marked retail or wholesale, which sets the prices they pay. Each customer shows their invoices and balance.
- **Suppliers and purchase orders**: order stock (PO-000001) and receive deliveries in full or in parts. Receiving adds stock and updates the product's cost. Pay suppliers in advance or after delivery and track what Trifold owes.
- **Products**: SKU, category, unit, cost, and retail and wholesale prices, plus a reorder level that flags *Low* or *Out* across all locations.
- **Locations** and **stock movements**: receive, issue, transfer and adjust (to a physical count), each logged with who, when and why. Stock can never go negative, even under simultaneous sales.
- **Reports**: revenue, cost of goods sold and gross profit for any date range; sales by product; money received by payment method; stock value; customers who owe and suppliers owed. Every report downloads as a CSV file that opens in Excel.
- **Dashboard**: today's sales, money owed both ways, stock value, reorder alerts and expected deliveries.
- **Roles**:

  | Role    | Sell, take payments, receive deliveries, move stock | Change prices on a sale, cancel sales | Products, locations, suppliers, purchase orders | Reports | Users and settings |
  |---------|:---:|:---:|:---:|:---:|:---:|
  | Staff   | ✓ |   |   |   |   |
  | Manager | ✓ | ✓ | ✓ | ✓ |   |
  | Admin   | ✓ | ✓ | ✓ | ✓ | ✓ |

- Products, locations, customers and suppliers are **archived** rather than deleted, so history is kept.
- Amounts are in **naira**. Money is stored as whole kobo, so totals never suffer rounding errors.

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
is `admin@trifold.local` / `ChangeMe123!`. **Change it** on the *Your account* page,
then fill in Trifold's address and bank details under *Settings*.
The seed adds a sample engine-oil catalogue, suppliers, customers, a purchase order and sales.
Set `SEED_DEMO_DATA="false"` to start with only the admin account.

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
    sales/ customers/ products/ movements/ locations/
    purchases/ suppliers/ reports/ users/ settings/ account/
  api/export/[report]/   CSV downloads
components/              Shared UI (forms, tables, badges)
lib/
  stock.ts               Movement rules and stock-level updates (transactional)
  sales.ts               Sales, customer payments and cancellations
  purchasing.ts          Purchase orders, receiving and supplier payments
  reports.ts, csv.ts     Report queries and CSV export
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
