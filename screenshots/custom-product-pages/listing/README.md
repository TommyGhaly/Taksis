# Default App Store listing

The main product page, the one everyone who finds Taksis on the App Store sees.

Upload this in **App Store Connect** (in the browser), not Xcode. Xcode only uploads builds.
Open App Store Connect → Taksis → the version you're preparing (**iOS App** in the sidebar),
then fill each slot from its numbered folder:

1. **iPhone 6.9" display** (1320 × 2868): drag in everything from [`1-iPhone-6.9/`](1-iPhone-6.9) (7 files)
2. **iPhone 6.1" or 6.3" display** (1206 × 2622): drag in everything from [`2-iPhone-6.3/`](2-iPhone-6.3) (7 files)
3. **iPad 12.9" or 13" display** (2752 × 2064): drag in everything from [`3-iPad-13/`](3-iPad-13) (6 files)
4. **Header Asset** (3840 × 1646): drag in everything from [`4-Header-Asset/`](4-Header-Asset) (1 file)
5. **Search Results Asset** (3840 × 2560): drag in everything from [`5-Search-Results-Asset/`](5-Search-Results-Asset) (1 file)
6. **Promotional text:** paste [`promotional-text.txt`](promotional-text.txt) (135 of 170 characters)
7. **Subtitle:** paste [`subtitle.txt`](subtitle.txt) (29 of 30 characters)
8. **Keywords:** paste [`keywords.txt`](keywords.txt) (100 of 100 characters)
9. **Description:** paste [`description.txt`](description.txt) (1363 of 4000 characters)

App previews (videos) are optional and aren't included.

[`alternate-5244x2950/`](alternate-5244x2950) has a 16:9 version that either the header
slot or the search results slot accepts, if you'd rather use one image for both.

The default listing has no deep link. Those are only for custom product pages.

These images are generated. To change them, edit [`../src/shots.html`](../src/shots.html)
and run `../src/render.sh` rather than editing the PNGs.
