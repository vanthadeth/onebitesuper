import test from "node:test";
import assert from "node:assert/strict";
import {
  seedConfig,
  lineAmounts,
  cartAmounts,
  roundInvoice,
  available,
  consumption,
  type Line,
  type Cart,
  type Invoice,
} from "./domain.ts";
const line = (overrides: Partial<Line> = {}): Line => ({
  id: "line",
  product: seedConfig.products[0],
  qty: 1,
  sauce: "original",
  extra: null,
  percent: 0,
  fixed: 0,
  free: false,
  ...overrides,
});
const cart = (lines: Line[]): Cart => ({
  id: "cart",
  lines,
  receiptPercent: 0,
  created: new Date().toISOString(),
  label: "",
});
test("fixed discounts apply per quantity, including modifier prices", () => {
  const row = lineAmounts(
    line({ qty: 2, extra: "sichuan", fixed: 500 }),
    0,
    seedConfig,
  );
  assert.equal(row.gross, 12000);
  assert.equal(row.discount, 1000);
  assert.equal(row.net, 11000);
});
test("receipt and item discounts use the higher amount and enforce both item caps", () => {
  assert.equal(
    lineAmounts(line({ percent: 15 }), 10, seedConfig).discount,
    750,
  );
  assert.equal(lineAmounts(line({ percent: 5 }), 15, seedConfig).discount, 750);
  assert.equal(
    lineAmounts(line({ percent: 80 }), 15, seedConfig).discount,
    1000,
  );
  assert.equal(
    lineAmounts(
      line({ product: { ...seedConfig.products[0], maxFixed: 300 } }),
      15,
      seedConfig,
    ).discount,
    300,
  );
});
test("complimentary items include all modifiers for free", () => {
  const row = lineAmounts(
    line({ qty: 2, sauce: "sichuan", extra: "sichuan", free: true }),
    15,
    seedConfig,
  );
  assert.equal(row.gross, 13000);
  assert.equal(row.net, 0);
});
test("round once at invoice level, with a distinct adjustment", () => {
  assert.equal(roundInvoice(5440), 5400);
  assert.equal(roundInvoice(5450), 5500);
  const draft = { ...cart([line({ qty: 2, percent: 1 })]), receiptPercent: 0 };
  const amounts = cartAmounts(draft, seedConfig);
  assert.equal(amounts.total, 9900);
  assert.equal(amounts.rounding, 0);
});
test("shared variants reserve base units; cancellation restores capacity", () => {
  const small = cart([line({ free: true, qty: 2 })]);
  const large = cart([
    line({ id: "large", product: seedConfig.products[1], free: true }),
  ]);
  const group = seedConfig.groups[0];
  assert.equal(consumption(small, group.id), 10);
  assert.equal(available(group, [small, large], []), 10);
  assert.equal(available(group, [large], []), 20);
  assert.equal(available(group, [small, large], [], "line"), 20);
  const cancelled: Invoice = {
    ...small,
    status: "cancelled",
    completed: new Date().toISOString(),
    total: 0,
    cash: 0,
    qr: 0,
  };
  assert.equal(available(group, [], [cancelled]), 30);
  const paid: Invoice = { ...cancelled, status: "paid" };
  assert.equal(available(group, [], [paid]), 20);
});
