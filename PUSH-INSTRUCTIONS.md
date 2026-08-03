# Pushing this to GitHub

The repository is already initialised, committed and tagged `v1.0.0`.
Nothing is staged or pending — you only need to add a remote and push.

## Read this first

**GitHub Pages sites are public by default, even from a private repository.**
Making the published site private requires GitHub Enterprise Cloud with access
control enabled.

This file embeds SunPower engineering reference data — a 517-city design
temperature database, electrical specs for 12 modules and 6 microinverters, the
SunPower logo, and Salesforce report column names. There are no credentials and
no secrets, but it is internal data.

**Confirm with your security team before enabling Pages.**

## 1. Create the repository

On github.com, create a repository named **`speed-design-tool`** under the
**newhomes-ops** account: https://github.com/newhomes-ops/speed-design-tool
Do not initialise it with a README, licence or .gitignore — this repo already
has them and GitHub's versions would conflict.

## 2. Push

Open a terminal in this folder and run:

```bash
git remote add origin https://github.com/newhomes-ops/speed-design-tool.git
git push -u origin main
git push origin v1.0.0
```

Git will prompt for authentication. Use a **personal access token** as the
password, or install GitHub CLI and run `gh auth login` first. Do not paste a
token into any file in this repository.

## 3. Optional — enable Pages

`newhomes-ops` is a **user account, not an organisation**. GitHub Pages access
control requires an organisation on Enterprise Cloud, so a Pages site published
from this account **cannot be made private** — it will be publicly readable and
indexable. That is not configurable.

Your five existing repositories are already public, so this matches your current
practice. Proceed knowingly:

1. Repository **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**
4. There is no private-visibility option on a user account. The site is public.

The site will serve at **https://newhomes-ops.github.io/speed-design-tool/**
`index.html` redirects to `SPEED.html`.

**Pages gives you one genuine advantage:** a real HTTPS origin. That is what
would let a Salesforce admin add the origin to the CORS allowlist and enable
live report access from the browser — which is impossible from a `file://` page.

## 4. Releasing an update

```bash
# Edit APP_VERSION and APP_BUILD near the top of SPEED.html's <script> block,
# and add a CHANGELOG entry.
node tests/run-tests.js          # must pass before you ship
git commit -am "SPEED 1.0.1 — <what changed>"
git tag -a v1.0.1 -m "SPEED 1.0.1"
git push && git push --tags
```

Then copy `SPEED.html` to the synced SharePoint library. **Keep the filename
exactly `SPEED.html`** — browser folder permissions are tied to the file origin,
so renaming it forces every designer to re-pick their folder.

## What is deliberately excluded

`.gitignore` blocks `*.csv`, `*.xlsm`, `*.dwg`, `*-extract-*.bas`, `config.ini`
and `credentials*`. Salesforce report exports contain customer names and
addresses; the VBA extracts contain hardcoded report URLs and network paths.
Verified clean before the first commit.
