#!/bin/zsh
# Renders every shot in shots.html to a 1320x2868 PNG (App Store 6.9" size).
cd "${0:A:h}/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC="file://${PWD}/src/shots.html"
ids=(${(f)"$(grep -oE "^  '[a-z]+-[0-9]+'" src/shots.html | tr -d " '")"})
for id in $ids; do
  page=${id%-*}
  mkdir -p "$page"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1320,2868 --user-data-dir="$(mktemp -d)" \
    --screenshot="${PWD}/${page}/${id}.png" "${SRC}?shot=${id}" >/dev/null 2>&1 &
done
# Chrome exits non-zero on a teardown watchdog even after writing the file, so check outputs instead.
# It also hangs after writing; give each run time to finish, then clean up.
sleep 20
pkill -f "Chrome.*--headless" 2>/dev/null
for id in $ids; do
  f="${id%-*}/${id}.png"
  [[ -s $f ]] && echo "rendered $f" || { echo "MISSING $f"; exit 1; }
done
