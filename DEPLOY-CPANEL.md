# Putting Trifold Global online (cPanel + Supabase)

The system runs on your cPanel hosting. The data lives in a Supabase database.
You do this once. Updates afterwards take about five minutes (see the end).

You'll need:
- cPanel login for the hosting account
- Admin access to the Supabase organisation
- Admin access to the GitHub repository `davinabilesanmi/trifold`

---

## 0. Check with the hosting company first

Ask them to confirm all four. If any answer is "no", stop and tell your developer.

1. cPanel has **"Setup Node.js App"**, with **Node.js 20.9 or newer** (22 is best).
2. The account can use at least **1 GB of memory** for the app.
3. The server can make **outgoing connections to ports 5432 and 6543** (this is how it reaches the Supabase database).
4. **AutoSSL** (free HTTPS) is available for a subdomain. The system needs HTTPS to keep people signed in.

---

## 1. Create the database (Supabase)

1. In your Supabase organisation, click **New project**.
   - Name: `trifold`
   - Database password: click **Generate a password** and **save it in a password manager**. You'll need it below, and Supabase won't show it again.
   - Region: the one nearest Nigeria in the list.
2. When the project is ready, click **Connect** at the top of the page.
3. Copy two connection strings. Replace `[YOUR-PASSWORD]` in each with the password from step 1.
   - **Transaction pooler** (it uses port **6543**). Add this to the very end:
     `?pgbouncer=true&connection_limit=5`
     This becomes **DATABASE_URL**.
   - **Session pooler** (it uses port **5432**). Copy it as it is.
     This becomes **DIRECT_URL**.

   Use the *pooler* strings, not "Direct connection". The direct one doesn't work from most hosting servers.

Keep these two strings private. Anyone who has them can read and change all of Trifold's data.
Never send them by chat or email. Paste them only into GitHub (step 2) and cPanel (step 4).

---

## 2. Set up the tables and the owner account (GitHub)

1. In the GitHub repository, go to **Settings → Secrets and variables → Actions → New repository secret**.
   Add these four secrets:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Transaction pooler string from step 1 |
   | `DIRECT_URL` | the Session pooler string from step 1 |
   | `SEED_ADMIN_EMAIL` | the owner's email, used to sign in (e.g. the MD's email) |
   | `SEED_ADMIN_PASSWORD` | a temporary password for the owner (at least 8 characters) |

2. Go to the **Actions** tab, choose **"Set up or update the database"** and click **Run workflow**.
3. Wait for the green tick (about two minutes). The database is now ready, with one owner account and no sample data.

---

## 3. Get the package

1. In **Actions**, open **"Build cPanel package"** and click the latest run with a green tick.
   If there isn't one, click **Run workflow** and wait about five minutes.
2. Under **Artifacts**, download **trifold-cpanel**. GitHub downloads a zip that contains `trifold-cpanel.zip`.

---

## 4. Install it in cPanel

1. **Domains** (or **Subdomains**): create **`stock.trifoldglobal.com`**.
   Using a subdomain keeps your main website exactly as it is.
2. **SSL/TLS Status**: tick the new subdomain and click **Run AutoSSL**. Wait until it shows a valid certificate.
3. **File Manager**: in your home folder, upload `trifold-cpanel.zip`, then **Extract** it.
   This creates a folder named `trifold-cpanel`. Rename it to **`trifold-app`**.
4. **Setup Node.js App → Create Application**:

   | Setting | Value |
   |---|---|
   | Node.js version | 22 (or the newest offered, at least 20.9) |
   | Application mode | Production |
   | Application root | `trifold-app` |
   | Application URL | `stock.trifoldglobal.com` |
   | Application startup file | `server.js` |

   Under **Environment variables**, add:

   | Name | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | the Transaction pooler string |
   | `DIRECT_URL` | the Session pooler string |

   Click **Create**, then **Start** (or **Restart**).
   Don't click "Run NPM Install". Everything the system needs is already in the package.
5. Open **https://stock.trifoldglobal.com**. You should see the Trifold Global sign-in page.

---

## 5. First sign-in

1. Sign in with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.
2. **Your account**: change the password straight away.
3. **Settings**: check the business details. Enter the **cash and bank balance** on the day you start (the balance sheet counts from it). Add your bank details for invoices.
4. Then set up, in this order:
   1. **Locations**: the depot and each outlet.
   2. **Products**: each cement type, with prices and pack sizes (e.g. Trailer = 600 bags).
   3. **Suppliers**: Lafarge and Dangote.
   4. **Staff**: one account each, with their responsibilities and outlet.
   5. **Opening stock**: for each location, record the current count using **Movements → Adjust**.
   6. **Customers**: with **opening balances** for anyone who already owes money.
5. In GitHub, you can now delete the `SEED_ADMIN_PASSWORD` secret.

---

## Updating to a new version

1. Download the latest **trifold-cpanel** package (step 3).
2. If the update notes say **"database changed"**, run **"Set up or update the database"** in GitHub Actions first.
3. In File Manager, upload and extract the new zip, then replace the contents of `trifold-app` with the new `trifold-cpanel` folder's contents.
   Your environment variables are kept, because they're stored in the Node.js app settings.
4. In **Setup Node.js App**, click **Restart**.

---

## If something goes wrong

| What you see | Likely cause |
|---|---|
| "503" or "Incomplete response" | The app didn't start. Check the Node.js version is at least 20.9, and ask the host about the memory limit. The app's log file (shown in Setup Node.js App) has details. |
| An error page mentioning the database, or very slow pages | The server can't reach Supabase. Ask the host to allow outgoing ports 5432 and 6543. Also check the two connection strings and the password inside them. |
| You sign in and land back on the sign-in page | The site isn't on HTTPS. Re-run AutoSSL and use the `https://` address. |
| The page still shows the old version after an update | Click Restart in Setup Node.js App. |

Backups: Supabase backs up the database daily. You can also download any report as a CSV file from inside the system.
