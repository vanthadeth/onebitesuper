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
export const siteNames = ["Riverside", "Toul Kork", "BKK 1"];
export const sauceNames: Record<Sauce, [string, string]> = {
  original: ["ដើម", "Original"],
  chilly: ["ហឹរ", "Chilly"],
  sichuan: ["ស៊ីឈួន", "Sichuan"],
};
const allSauces: Sauce[] = ["original", "chilly", "sichuan"];
export const seedConfig: Config = {
  products: [
    {
      id: "dumpling-small",
      name: "Fried dumplings",
      km: "គាវបំពង",
      variant: "Small box · 5 pieces",
      variantKm: "ប្រអប់តូច · ៥ ដុំ",
      food: "dumplings",
      price: 5000,
      units: 5,
      group: "dumplings",
      sellable: true,
      sauces: allSauces,
      defaultSauce: "original",
      maxPercent: 20,
      maxFixed: 2000,
    },
    {
      id: "dumpling-large",
      name: "Fried dumplings",
      km: "គាវបំពង",
      variant: "Large box · 10 pieces",
      variantKm: "ប្រអប់ធំ · ១០ ដុំ",
      food: "dumplings",
      price: 9000,
      units: 10,
      group: "dumplings",
      sellable: true,
      sauces: allSauces,
      defaultSauce: "original",
      maxPercent: 20,
      maxFixed: 2000,
    },
    {
      id: "meatball-small",
      name: "Fried meatballs",
      km: "ប្រហិតបំពង",
      variant: "Small box · 10 pieces",
      variantKm: "ប្រអប់តូច · ១០ ដុំ",
      food: "meatballs",
      price: 5000,
      units: 10,
      group: "meatballs",
      sellable: true,
      sauces: allSauces,
      defaultSauce: "original",
      maxPercent: 20,
      maxFixed: 2000,
    },
    {
      id: "meatball-large",
      name: "Fried meatballs",
      km: "ប្រហិតបំពង",
      variant: "Large box · 20 pieces",
      variantKm: "ប្រអប់ធំ · ២០ ដុំ",
      food: "meatballs",
      price: 9000,
      units: 20,
      group: "meatballs",
      sellable: true,
      sauces: allSauces,
      defaultSauce: "original",
      maxPercent: 20,
      maxFixed: 2000,
    },
    {
      id: "tea",
      name: "Lemon Tea",
      km: "តែក្រូចឆ្មា",
      variant: "One size",
      variantKm: "ទំហំតែមួយ",
      food: "tea",
      price: 4000,
      units: 1,
      group: "tea",
      sellable: true,
      sauces: [],
      defaultSauce: "original",
      maxPercent: 20,
      maxFixed: 2000,
    },
    {
      id: "frozen",
      name: "Frozen dumplings",
      km: "គាវក្លាសេ",
      variant: "Ready to cook · 20 pieces",
      variantKm: "ងាយចម្អិន · ២០ ដុំ",
      food: "frozen",
      price: 15000,
      units: 20,
      group: "frozen",
      sellable: true,
      sauces: [],
      defaultSauce: "original",
      maxPercent: 20,
      maxFixed: 3000,
    },
  ],
  groups: [
    {
      id: "dumplings",
      name: "Fried dumplings",
      km: "គាវបំពង",
      unit: "dumplings",
      daily: 30,
    },
    {
      id: "meatballs",
      name: "Meatballs",
      km: "ប្រហិត",
      unit: "meatballs",
      daily: 40,
    },
    {
      id: "tea",
      name: "Lemon Tea",
      km: "តែក្រូចឆ្មា",
      unit: "drinks",
      daily: 5,
    },
    {
      id: "frozen",
      name: "Frozen dumplings",
      km: "គាវក្លាសេ",
      unit: "dumplings",
      daily: 20,
    },
  ],
  receiptMax: 15,
  split: false,
  rate: 4000,
  extraPrices: { original: 500, chilly: 500, sichuan: 1000 },
  saucePrices: { original: 0, chilly: 0, sichuan: 500 },
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
