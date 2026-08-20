# Running the Adswish dev server for preview

## Reproduce artifacts (fresh checkout)

1. Copy environment from the main checkout (never symlink):
   `cp "/Users/willgreer/Adswish 3/.env.local" .env.local`
2. Install dependencies with the project package manager:
   `npm install`

## Run the server

```bash
nohup npm run dev > .freebuff/preview.log 2>&1 < /dev/null &
echo "pid=$!"
disown
```

Then confirm it survived (`kill -0 <pid>` after ~5s) and wait until
`http://localhost:3000` answers before registering the preview.

Note: `.env.local` may contain LIVE Stripe keys. Never click through a
checkout/charge in the preview while live keys are present.
