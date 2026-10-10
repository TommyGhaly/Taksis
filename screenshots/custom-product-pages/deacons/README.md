# Deacons: custom product page

For deacons and altar servers. Reference name: `Deacons`.

Upload this in **App Store Connect** (in the browser), not Xcode. Xcode only uploads builds.
Open App Store Connect → Taksis → **Custom Product Pages** → **+**, then fill each slot
from its numbered folder:

1. **iPhone 6.9" display** (1320 × 2868): drag in everything from [`1-iPhone-6.9/`](1-iPhone-6.9) (3 files)
2. **iPhone 6.1" or 6.3" display** (1206 × 2622): drag in everything from [`2-iPhone-6.3/`](2-iPhone-6.3) (3 files)
3. **iPad 12.9" or 13" display** (2752 × 2064): drag in everything from [`3-iPad-13/`](3-iPad-13) (3 files)
4. **Header Asset** (3840 × 1646): drag in everything from [`4-Header-Asset/`](4-Header-Asset) (1 file)
5. **Search Results Asset** (3840 × 2560): drag in everything from [`5-Search-Results-Asset/`](5-Search-Results-Asset) (1 file)
6. **Promotional text:** paste [`promotional-text.txt`](promotional-text.txt) (135 of 170 characters)
7. **Deep link:** paste [`deep-link.txt`](deep-link.txt)

App previews (videos) are optional and aren't included.

[`alternate-5244x2950/`](alternate-5244x2950) has a 16:9 version that either the header
slot or the search results slot accepts, if you'd rather use one image for both.

The deep link opens Taksis but doesn't yet go to a specific screen. See "About the deep
links" in the [main README](../README.md).

These images are generated. To change them, edit [`../src/shots.html`](../src/shots.html)
and run `../src/render.sh` rather than editing the PNGs.
