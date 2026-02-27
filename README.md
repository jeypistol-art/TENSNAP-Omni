This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Data Retention Cleanup

This project includes an internal cleanup endpoint for automatic data purge:

- `POST /api/internal/retention/cleanup`
- Header: `x-retention-secret: <DATA_RETENTION_CRON_SECRET>`

Retention rules:

- Trial orgs: purge when `trial_ends_at + DATA_RETENTION_TRIAL_GRACE_DAYS` is exceeded
- Canceled orgs: purge when `updated_at + DATA_RETENTION_CANCELED_GRACE_DAYS` is exceeded

Environment variables:

- `DATA_RETENTION_CRON_SECRET`
- `DATA_RETENTION_TRIAL_GRACE_DAYS` (default: `14`)
- `DATA_RETENTION_CANCELED_GRACE_DAYS` (default: `30`)
- `DATA_RETENTION_BATCH_SIZE` (default: `50`)

GitHub Actions workflow is included at `.github/workflows/data-retention-cleanup.yml`.
Set repository secrets:

- `APP_BASE_URL` (example: `https://your-domain.com`)
- `RETENTION_CLEANUP_BASE_URL` (optional, preferred for GitHub Actions; use a hostname not protected by Cloudflare challenge, e.g. a workers.dev URL)
- `DATA_RETENTION_CRON_SECRET`

Notes:

- `RETENTION_CLEANUP_BASE_URL` must be configured in GitHub repository secrets (Actions secrets), because it is read by the GitHub Actions workflow at runtime.
- Setting `RETENTION_CLEANUP_BASE_URL` only in Cloudflare Worker/Pages environment variables does not affect the cleanup workflow request URL.

If GitHub Actions receives a Cloudflare "Just a moment..." HTML response (`HTTP 403`), the request is being blocked before the app code runs. In that case, point `RETENTION_CLEANUP_BASE_URL` to an internal/non-challenged hostname or add a Cloudflare WAF/Access bypass for `POST /api/internal/retention/cleanup`.

## Family Plan (Subdomain)

Family plan behavior is controlled by request host and feature flags:

- `FAMILY_HOST` (default: `family.10snap.win`)
- `FAMILY_HOSTS` (optional comma-separated hosts; overrides `FAMILY_HOST`)
- `NEXT_PUBLIC_FAMILY_HOST` (optional, for client-side UI hiding)
- `STRIPE_SCHOOL_SUBSCRIPTION_LINK` (default fallback is current provided link)
- `STRIPE_FAMILY_SUBSCRIPTION_LINK` (default fallback is current provided link)
- `STRIPE_SCHOOL_SETUP_FEE_LINK` (default fallback is current provided link)

Implemented behavior:

- `organizations.account_plan` is persisted as `school | family`
- family host enforces one student profile per account
- student registration API is blocked on family host
- Stripe checkout API returns Payment Link URL(s):
  - family: monthly subscription link only
  - school: setup fee link + monthly subscription link

## Cloudflare Deploy

This project is deployed with OpenNext + Cloudflare Workers.

1. Authenticate:
   - `npx wrangler login`
2. Build worker bundle:
   - `npm run build:worker`
3. Deploy:
   - `npm run deploy`

Current configurable vars are defined in [`wrangler.jsonc`](/C:/Users/use/dev/score-snap/wrangler.jsonc):

- `NEXTAUTH_COOKIE_DOMAIN` (recommended: `.10snap.win` for shared login across `10snap.win` and `family.10snap.win`)
- `ENFORCE_STRICT_SESSION_GUARD` (`false` recommended; set `true` only if you need strict kickout behavior)
- `FAMILY_HOST`
- `NEXT_PUBLIC_FAMILY_HOST`
- `STRIPE_SCHOOL_SUBSCRIPTION_LINK`
- `STRIPE_FAMILY_SUBSCRIPTION_LINK`
- `STRIPE_SCHOOL_SETUP_FEE_LINK`

If you need to override in Cloudflare dashboard:

1. `Workers & Pages` -> `tensnap01omni2026` -> `Settings` -> `Variables`
2. Update the values above
3. Re-deploy worker

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

 fix: resolve cleanup workflow Cloudflare challenge and Next.js build issue

  分けるなら（推奨）

  1. fix: wrap analytics pageview in Suspense for Next.js 16 build
  2. docs: clarify RETENTION_CLEANUP_BASE_URL must be set in GitHub Actions secrets

  workflow のログ改善も一緒に含めるなら

  - chore: improve retention cleanup workflow diagnostics for Cloudflare blocks
