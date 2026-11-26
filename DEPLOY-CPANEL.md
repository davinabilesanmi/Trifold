# Putting Trifold Global online (cPanel + Supabase)

The system runs on your cPanel hosting. The data lives in a Supabase database.
The database connection details are kept **only in Supabase and your cPanel**: never in GitHub, chat or email.
You do this once. Updates afterwards take about five minutes (see the end).

You'll need:
- cPanel login for the hosting account
- Admin access to the Supabase organisation
- Access to the GitHub repository `davinabilesanmi/trifold` (only to download the package)

---

## 0. Check with the hosting company first

Ask them to confirm all five. If any answer is "no", stop and tell your developer.

1. cPanel has **"Setup Node.js App"**, with **Node.js 20.9 or newer** (22 is best).
2. The account can use at least **1 GB of memory** for the app.
3. The server can make **outgoing connections to ports 5432 and 6543** (this is how it reaches the Supabase database).
4. **AutoSSL** (free HTTPS) is available for a subdomain. The system needs HTTPS to keep people signed in.
5. cPanel has **Terminal** (or SSH access). It's needed once, to set up the database.

---

## 1. Create the database (Supabase)

1. In your Supabase organisation, click **New project**.
   - Name: `trifold`
   - Database password: click **Generate a password** and **save it in a password manager**. You'll need it below, and Supabase won't show it again.
   - Region: the one nearest Nigeria in the list.
2. When the project is ready, click **Connect** at the top of the page, then the **ORMs** tab, and choose **Prisma**.
   Ignore the install steps and "Agent Skills" it shows; only the two connection lines are needed.
3. Copy the two lines. Replace `[YOUR-PASSWORD]` in each with the password from step 1.
   - **DATABASE_URL** uses port **6543** and ends with `?pgbouncer=true`.
     Add `&connection_limit=5` to the very end.
   - **DIRECT_URL** uses port **5432**. Copy it as it is.

   (On the "Connection string" tab, these are the **Transaction pooler** and **Session pooler** strings.
   Don't use "Direct connection": it doesn't work from most hosting servers.)

Keep these two lines private. Anyone who has them can read and change all of Trifold's data.
Paste them only into cPanel (step 3). Don't save them in GitHub or send them by chat or email.

---

## 2. Get the package

1. In the GitHub repository's **Actions** tab, open **"Build cPanel package"** and click the latest run with a green tick.
   If there isn't one, click **Run workflow** and wait about five minutes.
2. Under **Artifacts**, download **trifold-cpanel**. GitHub downloads a zip that contains `trifold-cpanel.zip`.

---

## 3. Install it in cPanel

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
---

## 4. Set up the database (cPanel Terminal, once)

1. In **Setup Node.js App**, open the Trifold app. At the top is a box headed **"Enter to the virtual environment"**, containing a command that starts with `source`. Copy it.
2. Open **Terminal** (in cPanel under *Advanced*), paste that command and press Enter.
3. Type this and press Enter:

   ```
   node setup-database.js
   ```

4. Answer its questions:
   - If it asks for a **connection string**, paste the **DIRECT_URL** line (port 5432). It shows only `*` as you paste, and it isn't saved anywhere.
   - It creates the tables, then asks for the **owner's name, email and password**. The password shows as `*`.
5. When it says **"All done"**, go back to **Setup Node.js App** and click **Restart**.
6. Open **https://stock.trifoldglobal.com**. You should see the Trifold Global sign-in page.

You can run `node setup-database.js` again at any time. It only adds what's missing and never deletes data.

If your plan has no Terminal, ask the host to run step 3 for you, or ask your developer.

---

## 5. First sign-in

1. Sign in with the owner email and password you just chose.
2. **Your account**: you can change the password here at any time.
3. **Settings**: check the business details. Enter the **cash and bank balance** on the day you start (the balance sheet counts from it). Add your bank details for invoices.
4. Then set up, in this order:
   1. **Locations**: the depot and each outlet.
   2. **Products**: each cement type, with prices and pack sizes (e.g. Trailer = 600 bags).
   3. **Suppliers**: Lafarge and Dangote.
   4. **Staff**: one account each, with their responsibilities and outlet.
   5. **Opening stock**: for each location, record the current count using **Movements → Adjust**.
   6. **Customers**: with **opening balances** for anyone who already owes money.

---

## Updating to a new version

1. Download the latest **trifold-cpanel** package (step 2).
2. In File Manager, upload and extract the new zip, then replace the contents of `trifold-app` with the new `trifold-cpanel` folder's contents.
   Your environment variables are kept, because they're stored in the Node.js app settings.
3. If the update notes say **"database changed"**, run `node setup-database.js` in the Terminal (step 4).
4. In **Setup Node.js App**, click **Restart**.

---

## If something goes wrong

| What you see | Likely cause |
|---|---|
| "503" or "Incomplete response" | The app didn't start. Check the Node.js version is at least 20.9, and ask the host about the memory limit. The app's log file (shown in Setup Node.js App) has details. |
| `setup-database.js` says "Couldn't connect to the database" | Check the password inside the connection string. If that's right, the host is blocking the connection: ask them to allow outgoing ports 5432 and 6543. |
| An error page mentioning the database, or very slow pages | The server can't reach Supabase. Ask the host to allow outgoing ports 5432 and 6543. Also check the two connection strings and the password inside them. |
| You sign in and land back on the sign-in page | The site isn't on HTTPS. Re-run AutoSSL and use the `https://` address. |
| The page still shows the old version after an update | Click Restart in Setup Node.js App. |

Backups: Supabase backs up the database daily. You can also download any report as a CSV file from inside the system.
