# Releasing SPEED

Everything is committed locally. Publishing is `git push`.

Open **Git Bash** or **PowerShell** in this folder:

```
cd "C:\Users\MTO-MarkKevinOlivar\OneDrive - SunPower\Documents\New Homes Operations\7. SPWR Business Services, Inc\AI Initiative\Design Tool\SPEED\speed-design-tool"
```

## Every release, from now on

```
git push origin main
git push --tags origin
```

That is it. The first push opens a browser window to sign in to GitHub; Git
Credential Manager remembers it afterwards.

Give it a minute — Pages rebuilds on push. Then check the version in the header at
https://newhomes-ops.github.io/speed-design-tool/ against `APP_VERSION` in
`SPEED.html`.

## Before pushing

```
node tests/run-tests.js
```

All tests must pass. They extract the logic from `SPEED.html` at run time, so they
test the file that actually ships.

Bump both constants near the top of the `<script>` block and add a `CHANGELOG.md`
entry:

```js
const APP_VERSION = "2.14.0";
const APP_BUILD   = "2026-08-05";
```

---

## One-time: the first real push

The local repository and the GitHub repository began as **unrelated histories** —
27 commits here, 17 there, no common ancestor. All seventeen of GitHub's were made
through the web interface (their committer is `GitHub`, not a push), which is why
`git push` had never worked and every update went through the upload page.

Run in this order:

```
git push origin github-web-history      # keep the old history on GitHub too
git push --force origin main            # replace main with the local history
git push --force --tags origin
```

The first line is optional but costs nothing, and it means abandoning the old
history only removes it from `main` rather than from the repository. It is also
kept locally as the branch `github-web-history` and the tag
`pre-force-push-github`.

### To undo

```
git reset --hard pre-force-push-github
git push --force origin main
```

### Verified before force-pushing — nothing is lost

| | |
|---|---|
| Files only on GitHub, would be deleted | **none** |
| Files added | `tests/run-tests.js` |
| Files changed | `SPEED.html`, `CHANGELOG.md` |
| Files already identical | `README.md`, `index.html`, `.gitignore`, `.nojekyll` |

---

## Stop using the web upload page

It works, but it commits as *"Add files via upload"* with no version, no message
and no tag, and it leaves this local repository as the only place the real history
exists. Eleven of GitHub's seventeen commits were that.

## Do not rename `SPEED.html`

Browser folder permissions are tied to the file origin. A new filename looks like
a different application and every designer has to re-pick their SPEED folder.
Version with `APP_VERSION` and git tags, never the filename.

## Pages is public

`newhomes-ops` is a **user account, not an organisation**. Pages access control
requires an organisation on Enterprise Cloud, so this site **cannot be made
private** — it is publicly readable and search-indexable. That is not
configurable.

The published file embeds SunPower engineering reference data: the 517-city design
temperature database, module and microinverter electrical specs, the SunPower
logo, and Salesforce report column names. No credentials, no secrets, but it is
internal data. Your other repositories are already public, so this matches current
practice — but it is worth a deliberate decision rather than a default.

## Reference data is not in git by default

`Reference Data/*.json` lives in the SPEED folder, not here, so designers' edits
persist without touching GitHub. If you want an audit trail for values that reach a
stamped drawing, commit those files too — they are small, and one row per line
means a diff shows exactly which row changed.

## What `.gitignore` deliberately excludes

`*.csv`, `*.xlsm`, `*.dwg`, `*-extract-*.bas`, `config.ini`, `credentials*`.
Salesforce report exports contain customer names and addresses; the VBA extracts
contain hardcoded report URLs and network paths.
