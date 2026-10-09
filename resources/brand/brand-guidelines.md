# OneBite brand guidelines — draft

Source: the ten original OneBite SVGs supplied by the user on 9 October 2026. Brand colors are extracted from the SVG fill values. Supporting UI colors, sizing, and spacing below are proposed design rules.

## Personality

The smiling dumpling mascot and hand-drawn stacked wordmark make OneBite warm, playful, and approachable. Keep the operational interface calm and clear: expressive branding at entry points, restrained decoration during ordering and cash confirmation. Round cards and generous spacing echo the mascot's soft outlines. Avoid decorative typography for prices, amounts, and operational instructions.

## Colors

| Role | Hex | Usage |
| --- | --- | --- |
| Brand orange, exact logo color | `#F57921` | Logos, main actions, selected accents |
| Brand black, exact logo color | `#000000` | Approved black artwork |
| Brand white, exact logo color | `#FFFFFF` | Approved white artwork, card surfaces |
| UI ink | `#1A1A1A` | Body text and text on orange buttons |
| Muted text | `#66615C` | Secondary information on light surfaces |
| Warm canvas | `#FFF9F4` | App background |
| Soft orange | `#FFF3E8` | Selected choices and secondary actions |
| Dark orange | `#A94800` | Orange text on light surfaces |
| Border | `#E7DDD4` | Card and input boundaries |
| Success | `#297A46` | Confirmed payment, completed confirmation |
| Warning | `#A96300` | Offline state, pending confirmation, discrepancy |
| Danger | `#B3261E` | Blocked action, invalid input, destructive confirmation |

White on brand orange has only 2.75:1 contrast. Use UI ink on orange buttons (6.33:1), and dark orange on white for text links (5.81:1). White logo artwork may still appear on orange because it is brand artwork, not small interface text. Do not use color alone to communicate status: include text and an icon. Status colors have operational meaning and are not alternative logo colors.

## Logo usage

Keep all supplied SVGs unchanged. The complete logo is horizontal; the wordmark itself is stacked. Use the mascot icon in compact app chrome and the complete logo on sign-in or a brand introduction. Repeated full logos on every transaction card would distract from ordering.

Proposed clear space: at least one quarter of the mascot's height around each placement. Proposed minimum on-screen widths: mascot 32px (prefer 40px+), complete logo 120px, wordmark 64px. Validate these sizes visually before approval; no official minimum-size rules were supplied. Use the original vector for large displays. The logo-kit SVG is a reference sheet.

## Typography

Use **Google Sans** for English and Khmer UI text, as requested. Retain the original outlined logo lettering. Do not rebuild the wordmark with a font.

| Style | Weight | Size / line height |
| --- | --- | --- |
| Display | Bold 700 | 32 / 48px |
| Heading | Bold 700 | 24 / 36px |
| Title | Medium 500 | 18 / 30px |
| Body | Regular 400 | 16 / 28px |
| Label | Medium 500 | 14 / 24px |
| Small | Regular 400 | 14 / 24px |
| Caption | Regular 400 | 12 / 22px |
| Money | Bold 700 | 26 / 40px |

Khmer is primary. Use generous line height and wrapping labels so upper/lower marks are not clipped. Keep at least 48px touch targets. Render amounts consistently, for example `៛ 15,000` and `$3.75`. Avoid artificial letter spacing for Khmer. Use exact installed Figma font/style names discovered from the font list instead of guessing style strings.

Figma font availability and Khmer coverage have not been verified because the Starter MCP limit blocks even font discovery. Do not claim that a fallback rendering proves Google Sans support. If Google Sans is unavailable, report that before substituting another family. A future PWA font source and its permitted distribution must be established during implementation; no font binaries were included in these uploads.

## Shared visual rules

Use a 4px spacing grid, normally 16px screen padding and 12px between cards. Inputs use 12px corners, cards 16px, sheets 24px, and status pills fully rounded. Primary actions use exact brand orange with ink labels. Selected options use soft orange with a border/checkmark. Keep totals and payment actions visible during checkout. Combine a meaningful label with every cash/QR, confirmation, and error state.

## Figma application status

The existing draft uses provisional orange and Noto Sans Khmer/Inter. This guideline supersedes those choices, but **the Figma file has not yet been updated**. Planned changes: import the supplied vector brand assets; change semantic brand/action tokens; keep inverse white separate from dark text on orange; replace UI text styles with verified Google Sans styles; apply the styles to existing components; and create a native editable guideline frame on the Shared components page. Existing POS instance overrides will need visual review after typography changes.
