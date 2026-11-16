# BingoRPC

Shows what you are watching on streaming sites as your Discord status

You pick the sites yourself. Nothing is read from a site until you add it.
Works on Edge and Chrome, on Windows.

## Install

BingoRPC has two parts. The extension reads the video. The **Helper** is a small
Windows app that talks to Discord (a browser extension is not allowed to do that itself).
You need both.

1. **Install the Helper**
   - Go to the [Releases page](https://github.com/Siamislam0098/BingoRPC/releases/tag/Release) and download **BingoRPC-main.zip**.
   - Extract it and run "BingoRPC-Helper-setup.exe". Windows may show "Windows protected your PC" because the file is not signed yet:
     click **More info**, then **Run anyway**.
2. **Install the Extension**
   - Edge: open `edge://extensions`, turn on **Developer mode**, click **Load unpacked**, choose the folder "Extension" under the extracted zip file.
3. **Close your browser completely and open it again.**
4. Keep the **Discord desktop app** open (It only works with discord clint).

Open the extension icon. **Helper app** and **Discord** should both say *Connected*.

## Adding sites

No site is built in.

1. Open a streaming site and click the BingoRPC icon.
2. Click **Add this site** and approve the browser's permission prompt.
3. Play a video. If **Video found** says No, many sites load the player from another domain:
   look under **Player domains found on this page** and click **Allow** next to the one marked "likely player".
4. You can also type a site in the **Add a site** box (`crunchyroll.com`, or paste any link from it).
5. The **Sites** list shows everything you added. The checkbox turns a site on or off. **Remove** takes the permission back.
