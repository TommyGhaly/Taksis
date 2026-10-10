#!/bin/zsh
# Renders every custom product page asset from shots.html:
# one folder per App Store Connect slot, numbered in upload order:
#   <page>/1-iPhone-6.9/              1320 x 2868  (rendered)
#   <page>/2-iPhone-6.3/              1206 x 2622  (downscaled from 6.9 -- same aspect ratio)
#   <page>/3-iPad-13/                 2752 x 2064  (rendered, landscape)
#   <page>/4-Header-Asset/            3840 x 1646
#   <page>/5-Search-Results-Asset/    3840 x 2560
#   <page>/alternate-5244x2950/       accepted by both the header and search slots
# then writes each page's promotional-text.txt, deep-link.txt and README.md.
cd "${0:A:h}/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC="file://${PWD}/src/shots.html"

# shot <query> <WxH> <out.png>
# Chrome hangs on exit after writing its screenshot (and exits non-zero when it does finish),
# so each job waits for its file rather than the process, then kills that Chrome. At most
# MAX_JOBS run at once; launching all ~60 together starves some past any fixed timeout.
MAX_JOBS=8
shot() {
  mkdir -p "${3:h}"
  rm -f "$3"
  while (( $(jobs -r | wc -l) >= MAX_JOBS )); do sleep 0.3; done
  (
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
      --window-size=${2/x/,} --user-data-dir="$(mktemp -d)" \
      --screenshot="${PWD}/$3" "${SRC}?$1" >/dev/null 2>&1 &
    pid=$!
    for _ in {1..300}; do [[ -s $3 ]] && break; sleep 0.2; done
    sleep 0.5  # let the PNG finish flushing
    kill $pid 2>/dev/null
  ) &
  outputs+=("$3")
}

outputs=()
ids=(${(f)"$(grep -oE "^  '[a-z]+-[0-9]+'" src/shots.html | tr -d " '")"})
# The drawer shots have no iPad version: on a landscape iPad the drawer is always open.
drawer_ids=(${(f)"$(grep -E "^  '[a-z]+-[0-9]+'.*'drawer'\]" src/shots.html | grep -oE "[a-z]+-[0-9]+" | head -n 99)"})
for id in $ids; do
  shot "shot=$id" 1320x2868 "${id%-*}/1-iPhone-6.9/$id.png"
  (( ${drawer_ids[(Ie)$id]} )) || shot "ipad=$id" 2752x2064 "${id%-*}/3-iPad-13/$id.png"
done
for page in scheduling attendance deacons listing; do
  shot "banner=$page&size=3840x1646" 3840x1646 "$page/4-Header-Asset/$page-header.png"
  shot "banner=$page&size=3840x2560" 3840x2560 "$page/5-Search-Results-Asset/$page-search.png"
  shot "banner=$page&size=5244x2950" 5244x2950 "$page/alternate-5244x2950/$page-5244x2950.png"
done

wait

for f in $outputs; do
  [[ -s $f ]] && echo "rendered $f" || { echo "MISSING $f"; exit 1; }
done

for f in */1-iPhone-6.9/*.png; do
  out="${f/1-iPhone-6.9/2-iPhone-6.3}"
  mkdir -p "${out:h}"
  sips -z 2622 1206 "$f" --out "$out" >/dev/null && echo "scaled   $out"
done

python3 src/page_readmes.py
