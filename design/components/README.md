# OneBite component studio

Interactive design specimens for visual review inside Codex. This is a standalone design artifact; existing POS/Admin application source is not changed. It does not record real orders, authenticate people, or transfer money. The two-person confirmation interaction illustrates the UI state, not production authentication.

Serve locally and open `/design/components/`. For example: `python -m http.server 5180 --bind 127.0.0.1` from the repository root. Keep the preview bound to localhost.

The gallery includes brand foundations, buttons/states, forms, sauce and extra selections, quantity controls, menu cards, cart lines, totals, cash/QR choices, complimentary completion, badges/offline warnings, allowance limits, POS/Admin navigation, data rows, metrics, handover panels, paid-order locks, and saved/loading feedback.

Use the top-right language control for Khmer/English. On desktop, Phone view narrows the gallery to a mobile specimen layout. Search filters components. Quantity, limits, selectors, tabs, toggles, and confirmation-dialog specimens respond to input. Values are samples.

Google Sans is locally loaded from the official Google Fonts repository: `ofl/googlesans/GoogleSans[GRAD,opsz,wght].ttf`. Its metadata declares Latin/Khmer support; fontTools confirmed that the gallery's initial Khmer/Latin sample contains no missing glyphs. Font weights span 400–700. The original OFL license and metadata are preserved in `resources/fonts/google-sans/`. Browser rendering must still be reviewed for clipping and wrapping.

The original OneBite logos are used unchanged. Exact brand orange is #F57921. Small orange text uses darker #A94800; primary orange buttons use ink #1A1A1A for contrast. SVG illustrations are local editable vectors, and outline icons come from the existing Lucide dependency.

No dedicated internal canvas-editing tool is available in this session; this artifact is displayed through Codex's browser preview. It is not a completed Canva or Figma design.

## Verification · 9 October 2026

- Desktop 1440×1060 and phone 390×844 render without horizontal page overflow or JavaScript errors.
- Browser font inspection confirms the Khmer specimen is actually rendered with the locally loaded Google Sans custom font.
- Quantity updates sold quantity/base units and cart amount; discount >15% disables Apply; insufficient allowance disables free selection; both distinct demo actor confirmations are needed to enable handover.
- Cancellation reason, search filtering, language switching, and phone review mode pass browser checks.
- Original logo assets remain unchanged. No production application or backend behavior was implemented in this design step.
