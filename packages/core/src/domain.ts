export type Language = "km" | "en";
export type Food = "dumplings" | "meatballs" | "tea" | "frozen";
export type Sauce = "original" | "chilly" | "sichuan";
export type Product = {
  id: string;
  name: string;
  km: string;
  variant: string;
  variantKm: string;
  food: Food;
  price: number;
  units: number;
  group: string;
  sellable: boolean;
  sauces: Sauce[];
  defaultSauce: Sauce;
  maxPercent: number;
  maxFixed: number;
};
export type Line = {
  id: string;
  product: Product;
  qty: number;
  sauce: Sauce | null;
  extra: Sauce | null;
  percent: number;
  fixed: number;
  free: boolean;
};
export type Cart = {
  id: string;
  lines: Line[];
  receiptPercent: number;
  created: string;
  label: string;
};
export type Invoice = Cart & {
  status: "paid" | "cancelled";
  total: number;
  cash: number;
  qr: number;
  reason?: string;
  reference?: string;
  completed: string;
};
export type Group = {
  id: string;
  name: string;
  km: string;
  unit: string;
  daily: number;
  start?: string;
  end?: string;
};
export type Config = {
  products: Product[];
  groups: Group[];
  receiptMax: number;
  split: boolean;
  rate: number;
  extraPrices: Record<Sauce, number>;
  saucePrices: Record<Sauce, number>;
};
export const sauceNames: Record<Sauce, [string, string]> = {
  original: ["ដើម", "Original"],
  chilly: ["ហឹរ", "Chilly"],
  sichuan: ["ស៊ីឈួន", "Sichuan"],
};
export const money = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(value)}៛`;
export const id = () => crypto.randomUUID();
export const newCart = (): Cart => ({
  id: id(),
  lines: [],
  receiptPercent: 0,
  created: new Date().toISOString(),
  label: "",
});
export const roundInvoice = (value: number) =>
  Math.floor((value + 50) / 100) * 100;
export function unitGross(line: Line, config: Config): number {
  return (
    line.product.price +
    (line.sauce ? config.saucePrices[line.sauce] : 0) +
    (line.extra ? config.extraPrices[line.extra] : 0)
  );
}
export function lineAmounts(
  line: Line,
  receiptPercent: number,
  config: Config,
) {
  const grossUnit = unitGross(line, config);
  const requested = Math.max(
    Math.floor((grossUnit * line.percent) / 100),
    line.fixed,
    Math.floor((grossUnit * Math.min(receiptPercent, config.receiptMax)) / 100),
  );
  const discountUnit = line.free
    ? grossUnit
    : Math.min(
        requested,
        Math.floor((grossUnit * line.product.maxPercent) / 100),
        line.product.maxFixed,
        grossUnit,
      );
  const gross = grossUnit * line.qty;
  const discount = discountUnit * line.qty;
  return { gross, discount, net: gross - discount, grossUnit, discountUnit };
}
export function cartAmounts(cart: Cart, config: Config) {
  const rows = cart.lines.map((line) =>
    lineAmounts(line, cart.receiptPercent, config),
  );
  const gross = rows.reduce((sum, row) => sum + row.gross, 0);
  const discount = rows.reduce((sum, row) => sum + row.discount, 0);
  const net = gross - discount;
  const total = roundInvoice(net);
  return { gross, discount, net, rounding: total - net, total };
}
export function consumption(cart: Cart, group: string) {
  return cart.lines
    .filter((line) => line.free && line.product.group === group)
    .reduce((sum, line) => sum + line.qty * line.product.units, 0);
}
export function cambodiaDay(value = new Date().toISOString()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function available(
  group: Group,
  carts: Cart[],
  invoices: Invoice[],
  excludedLine?: string,
) {
  const today = cambodiaDay();
  if ((group.start && today < group.start) || (group.end && today > group.end))
    return 0;
  const reserved = carts.reduce(
    (sum, cart) =>
      sum +
      consumption(
        {
          ...cart,
          lines: cart.lines.filter((line) => line.id !== excludedLine),
        },
        group.id,
      ),
    0,
  );
  const used = invoices
    .filter(
      (invoice) =>
        invoice.status === "paid" && cambodiaDay(invoice.completed) === today,
    )
    .reduce((sum, invoice) => sum + consumption(invoice, group.id), 0);
  return Math.max(0, group.daily - reserved - used);
}
