# OneBite menu — planning draft

Updated: 2026-10-09. Box and extra-sauce prices are explicitly mock data, not production configuration. Other supplied menu prices are planning values until production setup. Do not invent production prices.

## Confirmed menu

| Product | Variant / selling unit | Contents | Base price |
| --- | --- | --- | --- |
| Fried dumplings | Small Box | 5 dumplings | 5,000 KHR (mock) |
| Fried dumplings | Large Box | 10 dumplings | 9,000 KHR (mock) |
| Fried meatballs | Small Box | 10 meatballs | 5,000 KHR (mock) |
| Fried meatballs | Large Box | 20 meatballs | 9,000 KHR (mock) |
| Lemon Tea | One size | Volume not specified | 4,000 KHR |
| Ready-to-cook frozen dumplings | 1 bag | 20 frozen dumplings | 15,000 KHR |

Sauce options supplied: Original, Chilly, Sichuan. Sauce selection is required for applicable products, and a default sauce can be configured. A +500 KHR surcharge was stated adjacent to Sichuan in the initial menu; confirm that it applies only to Sichuan, with Original/Chilly included. Default sauce configuration scope is proposed, not yet specified.

Extra Sauce has its own selection from the sauce list, with a separately configurable price for each option. Mock prices: Original +500 KHR, Chilly +500 KHR, Sichuan +1,000 KHR. These replace the earlier assumption of a universal +500 KHR extra-sauce price. Maximum extra-sauce quantity is not yet specified.

Admin configures which items accept which sauces; eligibility is not hardcoded to fried products. Admin also configures which items/variants share a complimentary allowance pool. Block complimentary selection when a full item's required base-unit quantity exceeds the remaining allowance; do not partially discount it as free.

Discounts apply to the complete item price including selected sauce/add-ons. If the item is complimentary, its sauce/add-ons are also free.

## Proposed catalog model

- Fried dumplings and Fried meatballs are parent products with separately priced Small/Large sellable variants.
- Frozen dumpling bags are a separate sellable product; keep cooked and frozen forms distinguishable for later Inventory planning.
- Lemon Tea has one size and is one sellable item.
- Store contents-per-selling-unit separately from the selling quantity. Complimentary allowances count base units: two Small Boxes of dumplings consume ten dumpling units. Proposed analogous counts are ten/twenty meatballs per Small/Large Box, twenty dumplings per frozen bag, and one unit per Lemon Tea. Admin chooses allowance sharing explicitly. Proposed configuration includes a pool base-unit label and each eligible item's consumption factor so pooled quantities are unambiguous.
- Modifier groups attach to eligible products/variants, with required/optional selection, selection limits and site-specific option prices supported by the proposed model. Final scope depends on answers below.
- A cart line snapshots product, variant, modifiers, quantity, unit base price and modifier surcharges. Modifier selections appear on invoice details.
- Lines with different modifier selections remain distinct; identical selections can combine quantities.
- Do not implement automatic ingredient/stock consumption until Inventory units and recipes are specified.

## Proposed POS interaction

Tap a product, choose Small/Large if applicable, select sauce/add-ons, then add to cart. Show the base price, surcharges and final unit price before adding. Show contents such as "5 dumplings" alongside the box size.

## Decisions still needed

1. Production site prices will be configured later; keep mock values distinguishable from production records.
2. Main-sauce surcharge values have not been explicitly reconfirmed: initial menu lists Sichuan +500 KHR. Proposed default-sauce configuration is per product; configuration scope can be refined during Admin design.
3. Is Extra Sauce one optional portion or can customers select multiple? Maximum selection quantity must be configurable or explicitly defined.
4. Review allowance pool labels and consumption factors during Admin UI design, including non-dumpling items.

Product/variant Khmer and English display names, menu categories and images will be reviewed during UI planning.
