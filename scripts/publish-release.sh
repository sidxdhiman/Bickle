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

- **Automatic updates** — Bickle now checks GitHub Releases shortly after it starts. When a new version is available it downloads quietly in the background and shows an *Update ready — Restart now* banner; restarting finishes the install.
- **Settings → Updates** — see your installed version, check for updates on demand, and grab the download on platforms that cannot install themselves (the `.deb`).
- Self-updating applies to the **AppImage** and **Windows** installer; deb installs get a one-click link to the right release asset.

*This release also includes the De Niro-inspired startup animation shipped in 1.0.1.*
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
