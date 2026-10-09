# OneBite — Figma UI review

Design file: https://www.figma.com/design/MqVPDfppPO4uULnphyPEEt

Updated 2026-10-09. Application coding is paused at the user's request while the UI is designed in Figma.

## Current Figma contents

- `01 · Shared components`: semantic variables, Khmer text styles, editable vector food illustrations and icons, component families for buttons, fields, badges, choices, navigation, menu cards, cart lines, data rows, metrics, app headers and totals.
- `02 · POS`: 18 editable mobile screens covering sign-in, site/device selection, opening shift, menu, customization, cart, discounts, complimentary allowance, held carts, cash/QR/split payments, free-order completion, paid invoice, invoice list, unpaid cancellation, shared shift, and dual-confirmation withdrawal.
- `03 · Admin`: page created; screens remain pending.

This is an incomplete first draft, not an approved or fully validated design. There are no verified prototype links. One cart screenshot was inspected and revealed clipped totals and oversized action instances; shared control heights were corrected, but the existing instance overrides and remaining layouts need further work.

## Blocker

Figma returned: “You've reached the Figma MCP tool call limit on the Starter plan.” Further canvas edits and screenshot verification are blocked for this team. No upgrade, payment, team move, or change of ownership has been performed.

The file belongs to Vantha Deth’s team, as selected by the user. Continue when this team's MCP access becomes available. A different file/team requires the user's choice; do not silently recreate it elsewhere.

## Resume materials

- `../../resources/brand/`: ten original logo SVGs, extracted brand tokens, a draft brand guideline, and an SVG guideline board for manual import. The exact brand orange is `#F57921`. The user requests Google Sans for English and Khmer; it supersedes the provisional fonts, but font availability and script rendering must be verified before applying it. These changes have not yet been applied to Figma because the tool limit persists.

- `design-state.json`: actual Figma page/component/screen IDs, completed work, and outstanding validations.
- `screen-helpers.js`: design-only Figma Plugin API helpers; replace `PAGE_ID` with the target page ID before use. This is not application implementation code.
- `pending-design.json`: remaining POS states, essential Admin screens, responsive layouts, and precise layout corrections.

Before further Figma calls, load the required Figma skills and read current canvas state. Use existing IDs and repair the draft rather than duplicate completed screens. Review and verify the full design before resuming application work.
