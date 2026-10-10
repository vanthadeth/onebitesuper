# OneBite app icons

The original OneBite mascot paths are preserved from `resources/brand/one-bite-icon-orange.svg`.

| App | Logo color | Bottom-right badge |
| --- | --- | --- |
| POS | Orange `#F57921` | None |
| Admin | Matte charcoal `#282A2E` | Shield |
| Inventory | Matte green `#3F6B52` | Cargo box |
| Attendance | Matte blue `#456B8B` | Clock |

All icons use an opaque warm-white `#FFFDF8` canvas. Artwork and badges fit the maskable safe circle. Outputs include SVG, 192/512 px PWA PNGs and 180 px Apple touch PNGs.

Run `npm run icons` after changing the palette or badge definitions in `scripts/app-icons.mjs`. Playwright Chromium must be installed. Assets are copied into the three existing apps; Attendance assets are ready for its future app.
