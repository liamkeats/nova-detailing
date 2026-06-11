# Stage 4 CRM Authentication Setup

The Stage 4 V1 dashboard uses Supabase Auth for identity and Netlify Functions
for all CRM data access. The browser never receives `SUPABASE_SECRET_KEY`.

## 1. Create the two team users

In Supabase:

1. Open **Authentication > Users**.
2. Select **Add user > Create new user**.
3. Create Liam's account with `keatsliam@gmail.com`.
4. Create Elijah's account with the private email address he controls.
5. Set a unique temporary password for each user.
6. Enable **Auto Confirm User** for these manually created accounts.

Do not use a shared login. Each person should have a separate account.

## 2. Disable public registration

Open **Authentication > Providers > Email** and turn off the setting that
allows new users to sign up. Password sign-in must remain enabled.

Keep email confirmation enabled as the project default. The two manually
created users are already confirmed by the **Auto Confirm User** option.

## 3. Configure Auth URLs

Open **Authentication > URL Configuration**.

Set the production Site URL:

```text
https://thenovadetailing.ca
```

Add these Redirect URLs:

```text
https://thenovadetailing.ca/crm
https://**--ubiquitous-cheesecake-f7f10b.netlify.app/**
http://localhost:8888/**
```

The current password login does not depend on an email callback, but these
URLs prepare production, Netlify previews, and local testing for future
password recovery.

## 4. Add Netlify environment variables

In Netlify, open **Site configuration > Environment variables** and add:

```text
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
CRM_ALLOWED_EMAILS=keatsliam@gmail.com,ELIJAH_PRIVATE_EMAIL
```

Use the Supabase project's publishable key, not its secret key. Enter the
allowed emails as a comma-separated list with no quotes.

Keep the existing variables unchanged:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

`SUPABASE_SECRET_KEY` is read only inside Netlify Functions. It must never be
renamed to a `PUBLIC_` variable or included in browser code.

## 5. Test on a Netlify preview

1. Deploy a preview after the three new environment variables are available to
   deploy previews.
2. Open the preview's `/crm` route in a private browser window.
3. Confirm it redirects to `/crm/login`.
4. Sign in with one approved account.
5. Confirm the lead board loads and `/api/crm-overview` returns data.
6. Open a lead and confirm `/api/crm-lead?id=LEAD_ID` returns its details.
7. Sign out and confirm both API endpoints return `401` when requested without
   an authenticated session.
8. Try an email outside `CRM_ALLOWED_EMAILS` and confirm it cannot enter.

Do not test by sharing a production password or by placing any Supabase key in
the URL, browser console, or committed files.
