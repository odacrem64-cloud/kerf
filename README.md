# Kerf

Quoting, scheduling and job tracking for a countertop fabrication shop.

- **Quote builder** — measure in inches (fractions OK), pick stone, edges, sinks and cutouts. Kerf draws the pieces to scale, works out square feet, edge footage, slabs and seams, and prices it as you type. Print or save the customer copy as a PDF.
- **Job board** — Lead → Quoted → Sold → Templated → In fabrication → Installed → Closed, with drag and drop and flags for anything stuck.
- **Calendar** — templates, fabrication, installs and service calls by crew, with a daily capacity bar.
- **My Work** — each crew member's jobs for the day on their phone: address, directions, stone, cutouts, notes, and a **Mark done** button that moves the job forward.
- **Dashboard, customers, payments, checklists, team and price list.**

Everyone signs in with their own email and password. Crew logins only see their schedule and job details, not prices or money.

---

## Set it up (about 15 minutes, all on websites)

You need two free accounts: **Supabase** (stores the data and logins) and **Vercel** (runs the website). Sign up for both with your GitHub account to save time.

### 1. Create the database (Supabase)

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign in with GitHub.
2. Click **New project**. Name it `kerf`, set a database password (save it somewhere), pick the region closest to the shop, and click **Create new project**. Wait a minute for it to finish.
3. In the left menu, open **SQL Editor** → **New query**.
4. Open [`supabase/schema.sql`](supabase/schema.sql) in this repo, copy everything, paste it in, and click **Run**. You should see "Success." (After Kerf updates, run the newest version of this file again. It's safe to re-run.)
5. Recommended: **Authentication** → **Sign In / Providers** → turn off **Allow new users to sign up**. Kerf creates logins itself, so nobody needs to sign up on their own.

### 2. Copy three values from Supabase

1. **Project URL** — on the project's home page (or **Project Settings** → **Data API**). Looks like `https://abcdefgh.supabase.co`.
2. **Publishable key** — **Project Settings** → **API Keys**. Starts with `sb_publishable_`.
3. **Secret key** — same page, under **Secret keys**. Starts with `sb_secret_`. Keep this one private: it only goes into Vercel.

### 3. Put the website online (Vercel)

1. Go to [vercel.com](https://vercel.com) → **Sign up** → continue with GitHub.
2. Click **Add New…** → **Project**, find this repo, and click **Import**.
3. Leave the framework as **Other**. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | your publishable key |
   | `SUPABASE_SECRET_KEY` | your secret key |

4. Click **Deploy**. When it finishes, click the preview to open your site.

### 4. Create your shop

Open the site and tap **Create a shop**. Name the shop and enter the owner's name, email and password. That login has full access.

### 5. Bring in the crew

1. Go to **Prices & Settings** and enter your real prices and your shop's phone and address (they print on quotes).
2. Go to **Team**. Your **shop code** is at the top. Tap **Copy invite** and text it to your crew.
3. Each worker opens the website, taps **Join a shop**, enters the code, their name, email and a password.
4. Their request shows up under **Join requests** on the Team page. Tap **Approve**, pick their role, and they're in.

You can also set someone up yourself: add them on the Team page and click **Create login** on their card. On a phone, crew can tap **Share → Add to Home Screen** to use Kerf like an app.

Forgot a password? The owner or office opens **Team** → **Manage** on that person's card → **Reset password**.

One website can run many shops. Each shop only ever sees its own data.

---

## Who can do what

| | Full access (owner, office) | Sales | Crew |
|---|---|---|---|
| Quotes, jobs, customers, calendar | ✓ | ✓ | view their jobs |
| Mark work done, add notes, checklists | ✓ | ✓ | ✓ |
| Money and prices on screen | ✓ | ✓ | — |
| Change the price list and settings | ✓ | — | — |
| Add team members and logins | ✓ | — | — |

Changing prices, settings, the team list and logins is blocked by the database itself, and nobody without an active login can see anything. Hiding money from crew happens on screen only: someone determined could still read job totals through the database, so treat it as tidy rather than secret.

---

## Costs

- **Vercel**: the free Hobby plan is for personal, non-commercial use, which covers building and showing Kerf. Once the shop runs on it day to day, switch the project to **Pro** in Vercel's settings. Nothing needs to be rebuilt and the address stays the same.
- **Supabase**: the free plan is enough for one shop to start. Free projects can be paused after a long stretch with no use; if that happens, open Supabase and click **Restore**.

## Using your own web address

In Vercel: your project → **Settings** → **Domains** → add something like `app.yourshop.com` and follow the steps it shows for your domain provider.

## If something goes wrong

- **The site says "Demo mode"** — the Supabase values aren't in Vercel yet, or the site hasn't been redeployed since you added them. In Vercel → **Deployments**, open the menu on the latest deployment and choose **Redeploy**.
- **"One more step"** — the database script hasn't been run. Do step 1.4.
- **"Check the secret key"** — the `SUPABASE_SECRET_KEY` in Vercel is wrong or missing. Copy it again from Supabase, save it in Vercel, and redeploy.
- **Someone can't sign in** — on the Team page, make sure their login is turned on, then reset their password.

## What's in this repo

| Path | What it is |
|---|---|
| `index.html`, `app.css`, `js/` | The app (plain HTML, CSS and JavaScript — no build step) |
| `api/` | Small server functions Vercel runs: settings check, create/join a shop, team logins |
| `supabase/schema.sql` | Database tables and access rules |
| `vendor/` | Supabase's JavaScript library |
| `icons/`, `manifest.webmanifest` | Phone home-screen icon |
