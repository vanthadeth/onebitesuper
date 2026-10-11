# Unified item catalog — first implementation

One catalog record/ID represents an item. Type (finished good, raw material, supplies, component), category and sale eligibility are independent. No business items or sample prices are seeded. The configured categories are Main, Side, Ready to cook and Drinks; existing categories remain available.

Owner manages items and categories/UOM. Staff with Inventory access can view. Active is true on creation and requires confirmation when changed. Base units remain immutable; item-specific conversions provide additional units without rewriting old quantities.

## Recipe definitions

Any item can contain Ingredients, Items in the box and Packaging used, simultaneously. Each line specifies an item, quantity and unit for the recipe's batch output. Expansion calculates raw material/supply quantities per output unit. Reusable components expand automatically. Cycles, missing/inactive children, invalid quantities and unconfigured conversions are rejected. Each item can define `1 other unit = factor base units`; these take precedence over standard kg/g and L/ml conversion. No prepared-product stock is created.

Raw materials and supplies without a recipe are direct stock inputs. With a recipe, they expand into underlying inputs like other recipe items. Items can be sold directly, independently of type. Sellable items require a category and whole-KHR master price. Categories are optional for other items.

## Versioning

Each successful item save atomically appends an immutable snapshot, operation receipt and audit entry. Version history is visible in item details. Effective-date fields explicitly use Asia/Phnom_Penh regardless of the device timezone. A future version is labelled Scheduled. Editing changes the latest catalog definition, while version selection for orders uses both effective and publication timestamps.

The core `snapshotItemForOrder` foundation freezes versions/conversions and computed material requirements at the first item added. Held orders must reuse this snapshot; future or later-published versions do not retroactively affect it. This helper is tested, but the current POS remains a placeholder: it does not yet create orders or post stock deductions.

## Migration and offline behavior

Existing catalog IDs, names, categories, prices, recipes and audit history are retained. Legacy finished recipes become components, sellable records become finished goods, and materials initially remain raw materials. Existing packaging records need Owner review and reclassification as supplies; the migration does not guess from names. Legacy recipe lines initially remain under Ingredients for Owner review. Historical duplicate names are retained; new saves enforce unified name uniqueness.

Existing records receive a baseline version using their last saved timestamp as effective time and this migration as publication time. This establishes the versioning baseline, not a reconstruction of recipe edits before this migration. Prior operation receipts remain intact.

Authorized SQLite cache includes definitions and versions. Encrypted Owner outbox changes survive reload and replay in dependency order (references, leaf materials, components, boxes). Published revision conflicts stay visible for review; retry IDs are immutable and idempotent. Previous-format pending changes are kept for review, not silently converted or dropped. Old clients can read but cannot overwrite unified definitions; refresh the app before editing.

## Following implementation steps

- Sauce choice groups, mandatory/default choice, extra sauce quantities/prices and selection-dependent breakdown.
- Actual batch count/yield records with review flags, without silently changing recipes.
- Cooking/packing instructions with step photos.
- Site sellability and site price overrides.
- Operational stock ledger and POS order integration: snapshot at first item; warn on shortages; deduct once on completed paid/free orders; no deductions for held/unpaid carts.

These are upcoming steps, not active stock-management features in this build.
