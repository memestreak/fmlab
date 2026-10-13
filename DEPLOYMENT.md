# Deployment Guide: Cloudflare Pages

This project builds to static files with Vite (`dist/`) and deploys to
Cloudflare Pages.

Production: <https://fmlab.pages.dev>

## Connecting to Cloudflare Pages

Follow these steps to set up auto-deployment from the GitHub repository.

### GitHub Prerequisites

You'll need to give the Cloudflare Pages GitHub app access to this
repository. This is configured in your GitHub personal settings, under
"Applications" in the left sidebar.

### Cloudflare Steps

Go directly to the Pages git-integration flow:

```
https://dash.cloudflare.com/?to=/:account/pages/new/provider/github
```

`:account` is a placeholder that Cloudflare resolves; paste the URL
as-is. Do **not** start from the **Create application** button -- it now
opens a unified Workers chooser ("Continue with GitHub", "Select a
template", ...), and "Continue with GitHub" there is Workers Builds,
which asks for deploy and preview commands and requires a
`wrangler.jsonc` this project does not have. The Cloudflare docs still
describe a **Pages** tab on that screen; the docs are stale.

From the repository picker:

1. Choose this repository and select **Begin setup**.
2. Fill in the form:

   | Field                  | Value                               |
   | ---------------------- | ----------------------------------- |
   | Project name           | becomes the `*.pages.dev` subdomain |
   | Production branch      | `main`                              |
   | Framework preset       | **Vite**                            |
   | Build command          | `npm run build`                     |
   | Build output directory | `dist`                              |
   | Root directory         | leave blank                         |

   The preset fills in the build command and output directory. Confirm
   they match; if the list has no Vite preset, choose **None** and type
   the two values in. No environment variables are needed.

3. Select **Save and Deploy**.
4. Put the project's URL on the "Production" line at the top of this file
   and in the command under "Verifying a Deployment".

## Automatic Builds

Once connected, every push to the `main` branch causes Cloudflare to:

1. Pull the latest code.
2. Run `npm install`.
3. Run the build command, `npm run build`.
4. Deploy the contents of the `dist` directory to the global edge network.

Pull requests get preview deployments at their own URLs, which repeat the
same build-and-deploy process.

## Project-Specific Notes

- **Routing.** The app is one page, `index.html`. There are no other
  routes, so it needs no `_redirects` file and no `404.html`.
- **Commit hash.** `vite.config.ts` reads the short commit hash via
  `git rev-parse` and compiles it in as `__COMMIT_HASH__` (Vite's
  `define`); the footer shows it. This works in the Cloudflare build
  environment because Pages clones the repository. Without git it is
  `dev`.
- **Node version.** `.node-version` pins Node 22. The Pages build image
  reads that file, and so does CI (`node-version-file` in
  `.github/workflows/ci.yml`), so tests and production builds run on the
  same major version. `engines` in `package.json` sets the floor for local
  work (`>=22.13.0`); newer versions are allowed there.
- **Type checking.** `npm run build` does not type-check (Vite only strips
  the types), so a type error does not fail a deployment. CI's
  `npm run typecheck` is what catches one.

## Local Verification

Verify the build locally with:

```bash
npm run build
npm run preview   # serves dist/ at localhost:4173
```

The static files are generated in the `dist/` directory, which is
gitignored.

## Verifying a Deployment

Check the deployed origin:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://fmlab.pages.dev/
```

Expected: `200`. The footer of the page shows the short hash of the commit
that was deployed.
