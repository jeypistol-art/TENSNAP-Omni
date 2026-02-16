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
- `DATA_RETENTION_CRON_SECRET`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
