#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
VERSION=$(python3 -c "import json;print(json.load(open('package.json'))['version'])")
TAG="v$VERSION"
DIR=dist-installers

CRED=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill)
TOKEN=$(printf '%s\n' "$CRED" | sed -n 's/^password=//p')
[ -n "$TOKEN" ] || { echo NO_TOKEN; exit 1; }

# Asset names come from the yml files — electron-updater downloads by those exact names.
WIN_PATH=$(sed -n 's/^path: //p' "$DIR/latest.yml" | head -1)
LINUX_PATH=$(sed -n 's/^path: //p' "$DIR/latest-linux.yml" | head -1)

BODY=$(cat <<'EOF'
## What's new

- **Profile → Check for Updates** — open your profile (avatar in the top bar) and you'll see a new *Check for Updates* section showing the installed version, a status pill (up to date / new version available), and a one-click button to check, download, and install the latest release.
- Works alongside the existing auto-update flow: AppImage and Windows installs still self-update in the background; the profile section gives you an on-demand check anytime.

## How to install

**Windows**
1. Download `Bickle-Setup-1.0.3.exe` below.
2. Run it and follow the installer (you can choose the install folder).
3. Launch **Bickle** from the Start Menu.

**Linux (AppImage — recommended, self-updating)**
1. Download `Bickle-1.0.3.AppImage` below.
2. Make it executable and run it:
   ```bash
   chmod +x Bickle-1.0.3.AppImage
   ./Bickle-1.0.3.AppImage
   ```

**Linux (`.deb`, Debian/Ubuntu)**
```bash
sudo dpkg -i bickle_1.0.3_amd64.deb
```

**Already have Bickle installed?** AppImage and Windows builds update themselves — just restart when the *Update ready* banner appears, or use the new profile check. For `.deb` installs, download the new `.deb` above and reinstall.

## How to use the update checker

1. Click your **avatar** in the top-right corner to open the profile modal.
2. Stay on the **Profile** tab — you'll see **Check for Updates** with your current version (e.g. `Version 1.0.3`).
3. Click **Check for updates**:
   - If you're current → green **UP TO DATE** pill.
   - If a new version exists → amber **vX.Y.Z AVAILABLE** pill and a **Download update** button (or automatic background download on AppImage/Windows).
   - When the download finishes → **Restart to update** installs it and relaunches the app.
   - If the check fails → an **Open the releases page →** fallback link appears.

You can also find the same controls under **Settings → Updates**.
EOF
)

PAYLOAD=$(python3 - "$TAG" "Bickle $VERSION" "$BODY" <<'PY'
import json, sys
print(json.dumps({
    "tag_name": sys.argv[1],
    "name": sys.argv[2],
    "target_commitish": "main",
    "body": sys.argv[3],
    "draft": False,
    "prerelease": False,
}))
PY
)

RESP=$(curl -sS -X POST "https://api.github.com/repos/sidxdhiman/Bickle/releases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

RELEASE_ID=$(printf '%s' "$RESP" | python3 -c "import json,sys; r=json.load(sys.stdin); print(r.get('id') or 'ERR:'+str(r.get('message','?')))")
echo "release_id=$RELEASE_ID"
case "$RELEASE_ID" in
  ERR:*|None*) printf '%s\n' "$RESP" | head -c 500; exit 1 ;;
esac

upload() {
  local file="$1" name="$2"
  [ -f "$file" ] || { echo "MISSING $file"; exit 1; }
  echo "uploading $name ($(stat -c%s "$file") bytes)..."
  local code
  code=$(curl -sS -o /tmp/opencode/upload-resp.json -w '%{http_code}' -X POST \
    "https://uploads.github.com/repos/sidxdhiman/Bickle/releases/$RELEASE_ID/assets?name=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$name")" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$file" --max-time 1800)
  echo "  http=$code"
  [ "$code" = "201" ] || { head -c 400 /tmp/opencode/upload-resp.json; echo; exit 1; }
}

upload "$DIR/$LINUX_PATH" "$LINUX_PATH"                       # AppImage (self-update)
upload "$DIR/bickle_${VERSION}_amd64.deb" "bickle_${VERSION}_amd64.deb"
upload "$DIR/$WIN_PATH" "$WIN_PATH"                           # NSIS (self-update)
upload "$DIR/$WIN_PATH.blockmap" "$WIN_PATH.blockmap"         # differential updates
upload "$DIR/latest.yml" "latest.yml"                         # update feed (Windows)
upload "$DIR/latest-linux.yml" "latest-linux.yml"             # update feed (Linux)

echo "ALL_DONE"
