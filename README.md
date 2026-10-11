# Midwest Surfaces — Shop Manager

Quoting, scheduling, job tracking and slab inventory for **Midwest Surfaces** — 21950 LaGrange Road, Unit B, Frankfort, IL (serving Mokena, Frankfort, New Lenox and the south suburbs). This site is built for one shop: after the owner login is created, no one else can set up a different company here. Employees join with the shop code and the office approves them.

- **Quote builder** — measure in inches (fractions OK), pick stone, edges, sinks and cutouts. It draws the pieces to scale, works out square feet, edge footage, slabs and seams, and prices it as you type. Print or save the customer copy as a PDF.
- **Job board** — Lead → Quoted → Sold → Templated → In fabrication → Installed → Closed, with drag and drop and flags for anything stuck.
- **Calendar** — templates, fabrication, installs and service calls by crew, with a daily capacity bar.
- **My Work** — each crew member's jobs for the day on their phone: address, directions, stone, cutouts, notes, and a **Mark done** button that moves the job forward.
- **Dashboard, accounts, payments, checklists, team and price list.**
- **Job files** — attach drawings, DXF/CAD files, plans, signed contracts and site photos to any job. Crew can snap photos from their phone.
- **Slab inventory** — serial-numbered slabs and remnants with rack locations, allocated to jobs and marked used when fabrication is completed.
- **Accounts & contacts** — builders, dealers and homeowners, each with their contacts, plus an on-site contact per job.
- **Moraware-style scheduling** — Estimate / Confirmed / Complete activities, your own activity types (Saw, CNC, Polish…), and a calendar by crew member.
- **Printable forms** — a job sheet for the shop floor and a day packet for each crew member.
- **Set up for Midwest Surfaces** — address, phone and showroom hours on every quote; their 11 edge profiles and sink lineup from mwsurfaces.com; their 75% deposit / pay-in-full-under-$2,000 rule; their full proposal wording on every printed quote (opening paragraph, Acceptance of Proposal with the 3-day cancellation, the 27 Terms and Conditions, and the What to Expect page — editable under Prices & Settings → Proposal wording); pre-measure checklist; AM/PM install windows; saw activity types for the Baca SawJet and Donatoni Jet.
- **Your logo** on the menu and on every quote, **profile photos** for the crew, and an **AI Shop Assistant** for how-to questions.

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

### 4. Create the owner login

Open the site and tap **Create the owner login**. Enter the owner's name, email and password. That login has full access. This only works once.

### 5. Bring in the crew

1. Go to **Prices & Settings** and enter your real prices and your shop's phone and address (they print on quotes).
2. Go to **Team**. Your **shop code** is at the top. Tap **Copy invite** and text it to your crew.
3. Each worker opens the website, taps **New to the team?**, enters the code, their name, email and a password.
4. Their request shows up under **Join requests** on the Team page. Tap **Approve**, pick their role, and they're in.

You can also set someone up yourself: add them on the Team page and click **Create login** on their card. On a phone, crew can tap **Share → Add to Home Screen** to use Kerf like an app.

Forgot a password? The owner or office opens **Team** → **Manage** on that person's card → **Reset password**.


### 6. Optional: turn on the AI Shop Assistant

Every page has an **AI Shop Assistant** button. Without any setup it answers common questions from a built-in guide. To let it answer anything in plain English using Claude (pay-as-you-go, about $5 minimum):

1. Create an API key at [console.anthropic.com](https://console.anthropic.com) (**API Keys** → **Create key**) and add a few dollars of credit. Each question costs a fraction of a cent.
2. In Vercel → **Settings** → **Environment Variables**, add `ANTHROPIC_API_KEY` with that key, then redeploy.

Only signed-in team members can use it, so strangers can't spend your credit.

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

- **Vercel**: the free Hobby plan is for personal, non-commercial use, which covers building and showing Kerf. Once Midwest Surfaces runs on it day to day, switch the project to **Pro** in Vercel's settings. Nothing needs to be rebuilt and the address stays the same.
- **Supabase**: the free plan is enough for one shop to start. It includes 1 GB of file storage (thousands of drawings and phone photos); files can be up to 50 MB each. If the shop fills it up, Supabase Pro is $25/month with 100 GB. Free projects can be paused after a long stretch with no use; if that happens, open Supabase and click **Restore**.

## Using your own web address

In Vercel: your project → **Settings** → **Domains** → add something like `app.midwestsurfaces.com` (if the shop owns that domain) and follow the steps it shows for your domain provider.

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
