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

- **Create your own account** — the login screen now opens with a *Create account* tile. Sign up with your name, email and password and you get your own private space for everyday use (tasks, notes, calendar, habits, money, whiteboard and more).
- **Sign in with email** — prefer email + password? Use *Sign in with email instead* on the login screen (e.g. sid@bickle.com with your password) — it lands on the exact same profile as before.
- **Chat & Art are owner-circle features** — accounts made from the signup screen ship **without Chat and without the Art / Sid-Art showcase**: a fresh install has nobody to chat with, and Sid-Art is the owner's public portfolio. Profiles created from inside the app (**Settings → Profiles**) keep both features, exactly like before.

## How to install

**Windows**
1. Download `Bickle-Setup-1.0.5.exe` below.
2. Run it and follow the installer (you can choose the install folder).
3. Launch **Bickle** from the Start Menu.

**Linux (AppImage — recommended, self-updating)**
1. Download `Bickle-1.0.5.AppImage` below.
2. Make it executable and run it:
   ```bash
   chmod +x Bickle-1.0.5.AppImage
   ./Bickle-1.0.5.AppImage
   ```

**Linux (`.deb`, Debian/Ubuntu)**
```bash
sudo dpkg -i bickle_1.0.5_amd64.deb
```

**Already have Bickle installed?** AppImage and Windows builds update themselves — just restart when the *Update ready* banner appears, or use **Profile → Check for Updates**. For `.deb` installs, download the new `.deb` above and reinstall. Your existing profiles and data carry over as-is.

## How to use it

1. First boot: pick **Create account** to make your own sign-in (or choose an existing profile).
2. Sign in with your email + password any time via **Sign in with email instead**.
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
