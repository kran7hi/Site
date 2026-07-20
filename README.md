# Kranthi — An Interactive Portrait

An elastic, hand-inked personal portrait built with Next.js, vinext, and
Cloudflare Pages. The character reacts to hover, drag, release, drawing, and
the pull-to-reveal profile panel.

## Expressions

<p align="center">
  <img src="public/character/head-neutral-v3.png" alt="Kranthi caricature — calm expression" width="23%">
  <img src="public/character/head-surprised-v3.png" alt="Kranthi caricature — surprised expression" width="23%">
  <img src="public/character/head-drag-v3.png" alt="Kranthi caricature — dragging expression" width="23%">
  <img src="public/character/head-release-v3.png" alt="Kranthi caricature — release expression" width="23%">
</p>

## Requirements

- Node.js `>=22.13.0`
- npm

## Local build and preview

```bash
npm ci
npm run build
python3 -m http.server 8788 --directory dist/client
```

Open `http://localhost:8788`.

Before pushing a change:

```bash
npm test
npm run lint
```

## Automatic Cloudflare Pages deployment

The repository is connected to the existing `kranthi-personal-site` Cloudflare
Pages project. Every push to `main` starts a production deployment
automatically.

Current production settings:

| Setting | Value |
| --- | --- |
| Git repository | `kran7hi/Site` |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist/client` |
| Root directory | Repository root (leave blank) |

To inspect or repair the existing Git connection:

1. Open **Workers & Pages → kranthi-personal-site**.
2. Open **Settings → Builds → Git repository**.
3. Choose **Manage** and verify `kran7hi/Site` with production branch `main`.
4. Verify the build command is `npm run build` and the output directory is
   `dist/client`.

To create a replacement Pages project:

1. Open **Workers & Pages** in the Cloudflare dashboard.
2. Choose **Create application → Pages → Connect to Git**.
3. Select the GitHub repository `kran7hi/Site`.
4. Set the production branch to `main`.
5. Use `npm run build` as the build command.
6. Use `dist/client` as the build output directory.
7. Leave the root directory blank and save the deployment.

If the build image does not select Node.js 22, add a Pages build variable named
`NODE_VERSION` with the value `22.13.0`.

Cloudflare will deploy future pushes to `main` and create preview deployments
for eligible non-production branches.

## Domains

The Pages project serves:

- `https://kranthireddy.com`
- `https://www.kranthireddy.com`
- `https://kranthi-personal-site.pages.dev`

To restore a domain, open the Pages project, select **Custom domains**, choose
**Set up a custom domain**, and follow Cloudflare's DNS prompts.

## Manual deployment

Automatic Git deployments are preferred. If a manual deployment is needed:

```bash
npx wrangler login
npm run deploy
```

The deploy script builds the site and uploads `dist/client` to the
`kranthi-personal-site` Pages project. This bypasses the Git build and creates a
separate deployment, so it should not normally be run after pushing `main`.

## Useful commands

- `npm run build` — create the production build
- `npm test` — build and run the rendered-site tests
- `npm run lint` — run the code-quality checks
- `npm run deploy` — manually deploy to Cloudflare Pages
- `npm run db:generate` — generate optional Drizzle migrations

## Project structure

- `app/` — page, portrait interaction, styles, and sound behavior
- `public/` — portrait, brand, and social-preview assets
- `tests/` — rendered output and interaction contract checks
- `wrangler.jsonc` — Cloudflare runtime and asset configuration
- `vite.config.ts` — vinext and Cloudflare Vite configuration
