# Publishing guide (one-time setup, then one command per release)

## A. One-time setup on GitHub

1. (Done) Your GitHub username is already set in `extension/popup.js` and `docs/STORE-LISTING.md`.
2. Add a `LICENSE` file (GitHub: Add file > Create new file > name it `LICENSE`, use the licence picker).
3. Repo **Settings > Secrets and variables > Actions > Variables > New repository variable**:
   - Name `DISCORD_CLIENT_ID`, value = your Discord Application ID.
4. Repo **Settings > Actions > General > Workflow permissions**: choose **Read and write permissions**.
5. Discord Developer Portal: the application NAME must be `BingoRPC`, and upload an image called `default`.

## B. Make a release (builds the helper installer for you)

1. Push the code to GitHub (branch `main`).
2. Tag and push:
   ```
   git tag v0.3.0
   git push origin v0.3.0
   ```
3. Open the repo **Actions** tab and wait for "Release" to turn green (a few minutes).
4. Open **Releases**. It must contain:
   - `BingoRPC-Helper-Setup.exe`  (what users run)
   - `BingoRPC-extension-store.zip`  (upload this to Edge Add-ons)
   - `BingoRPC-extension-sideload.zip`  (for people who load it by hand)
5. Download the installer on a Windows PC and test it before telling anyone:
   install, restart Edge, load the sideload zip, check the popup says Helper = Connected.

Raising the version: change `"version"` in `extension/manifest.json` (the store needs a higher number each upload), then tag `v0.3.1` and so on.

## C. Publish the extension on Edge Add-ons (free)

1. Go to the Microsoft Partner Center Edge program and sign in with **GitHub** (a Microsoft account is created for you).
   Choose **Individual**, country Bangladesh. Finish verification.
2. Create a new extension, upload `BingoRPC-extension-store.zip`.
3. Fill the listing from `docs/STORE-LISTING.md`. Privacy policy URL = the link to `PRIVACY.md` on GitHub.
4. Submit. Wait for review.

## D. After approval (do not skip)

The store gives the extension a new ID, so the helper would refuse it.

1. Copy the extension ID from the store page (or `edge://extensions` after installing it from the store).
2. Add it to `installer/com.bingorpc.host.json`:
   ```
   "allowed_origins": [
     "chrome-extension://hpnbmdkchlknkobmloldgfedldljjdgc/",
     "chrome-extension://<STORE_ID>/"
   ]
   ```
3. Commit, tag a new release (`v0.3.1`). Users run the new installer once.
4. Put the store link in `README.md`.

Tip: in the popup, "Helper app: Not installed / not running" with the helper installed usually means this ID step is missing.
