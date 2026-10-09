import { SelectField } from "@onebite/ui";
import { useEffect, useRef, useState } from "react";
import {
  ShoppingBag,
  Search,
  ArrowRight,
  Pause,
  ListOrdered,
  Clock3,
  SlidersHorizontal,
  Plus,
  Trash2,
  ChevronRight,
  CreditCard,
  Banknote,
  QrCode,
  Gift,
  ReceiptText,
  Wallet,
  ArrowUpRight,
  Calculator,
  Check,
  WifiOff,
  RotateCcw,
  X,
  ImagePlus,
  Settings2,
} from "lucide-react";
import {
  type Cart,
  type Line,
  type Product,
  type Sauce,
  type Config,
  type Invoice,
  money,
  seedConfig,
  siteNames,
  sauceNames,
  newCart,
  id,
  unitGross,
  cartAmounts,
  lineAmounts,
  available,
} from "@onebite/core";
import {
  Header,
  DemoBanner,
  useLanguage,
  useLocalState,
  FoodArt,
  Modal,
  Field,
  Quantity,
  Empty,
  Status,
  Stat,
  Toggle,
  haptic,
} from "@onebite/ui";

type SiteState = {
  cart: Cart;
  held: Cart[];
  invoices: Invoice[];
  withdrawals: { id: string; amount: number; reason: string; time: string }[];
};
type Store = { site: number; sites: SiteState[]; config: Config };
const initial = (): Store => ({
  site: 0,
  sites: siteNames.map(() => ({
    cart: newCart(),
    held: [],
    invoices: [],
    withdrawals: [],
  })),
  config: structuredClone(seedConfig),
});
type Screen = "sell" | "invoices" | "shift" | "more";
const positive = (value: string) => Math.max(0, Math.floor(Number(value) || 0));
const orderName = (cart: Cart) =>
  cart.label || `#${cart.id.slice(0, 4).toUpperCase()}`;

export function App() {
  const { t, lang } = useLanguage();
  const [state, setState, storageError] = useLocalState<Store>(
    "onebite-pos-preview-v1",
    initial,
  );
  const site = state.sites[state.site];
  const [screen, setScreen] = useState<Screen>("sell");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{
    product: Product;
    line?: Line;
  } | null>(null);
  const [heldOpen, setHeldOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [cancel, setCancel] = useState<Cart | null>(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState("");
  const [calculator, setCalculator] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  function updateSite(fn: (site: SiteState) => SiteState) {
    return setState((old) => ({
      ...old,
      sites: old.sites.map((item, index) =>
        index === old.site ? fn(item) : item,
      ),
    }));
  }
  function updateCart(fn: (cart: Cart) => Cart) {
    return updateSite((old) => ({ ...old, cart: fn(old.cart) }));
  }
  function hold(openList = false) {
    if (site.cart.lines.length) {
      if (
        !updateSite((old) => ({
          ...old,
          held: [old.cart, ...old.held],
          cart: newCart(),
        }))
      )
        return;
      if (!openList)
        setToast(
          t("បានរក្សាទុកការកុម្ម៉ង់", "Cart held. A fresh cart is ready."),
        );
    }
    if (openList) setHeldOpen(true);
    haptic();
  }
  function switchSite(next: number) {
    setState((old) => ({ ...old, site: next }));
    setCartOpen(false);
    setScreen("sell");
  }
  function addLine(line: Line) {
    if (
      !updateCart((cart) => ({
        ...cart,
        lines: editor?.line
          ? cart.lines.map((existing) =>
              existing.id === line.id ? line : existing,
            )
          : [...cart.lines, line],
      }))
    )
      return;
    setEditor(null);
    haptic();
    setToast(t("បានបន្ថែមទៅកន្ត្រក", "Added to cart"));
  }
  function changeQty(line: Line, qty: number) {
    const group = state.config.groups.find(
      (group) => group.id === line.product.group,
    );
    if (
      line.free &&
      group &&
      qty * line.product.units >
        available(group, [site.cart, ...site.held], site.invoices, line.id)
    ) {
      setToast(
        t(
          "ចំនួនអនុញ្ញាតមិនគ្រប់គ្រាន់",
          "Insufficient complimentary allowance",
        ),
      );
      return;
    }
    updateCart((cart) => ({
      ...cart,
      lines: cart.lines.map((item) =>
        item.id === line.id ? { ...item, qty } : item,
      ),
    }));
  }
  function paid(cash: number, qr: number, reference?: string) {
    const totals = cartAmounts(site.cart, state.config);
    const invoice: Invoice = {
      ...site.cart,
      status: "paid",
      total: totals.total,
      cash,
      qr,
      reference,
      completed: new Date().toISOString(),
    };
    if (
      !updateSite((old) => ({
        ...old,
        invoices: [invoice, ...old.invoices],
        cart: newCart(),
      }))
    )
      return;
    setPayOpen(false);
    setCartOpen(false);
    setToast(t("បានបញ្ចប់ការកុម្ម៉ង់សាកល្បង", "Sample order completed"));
    haptic();
  }
  const totals = cartAmounts(site.cart, state.config);
  const itemCount = site.cart.lines.reduce((sum, line) => sum + line.qty, 0);
  const filtered = state.config.products.filter(
    (product) =>
      product.sellable &&
      (category === "all" || product.food === category) &&
      `${product.name} ${product.km} ${product.variant} ${product.variantKm}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const nav = [
    { id: "sell", label: t("លក់", "Sell"), icon: ShoppingBag },
    { id: "invoices", label: t("វិក្កយបត្រ", "Invoices"), icon: ReceiptText },
    { id: "shift", label: t("វេន", "Shift"), icon: Clock3 },
    { id: "more", label: t("ផ្សេងទៀត", "More"), icon: SlidersHorizontal },
  ] as const;
  const focusMenuOnClose = useRef(false);
  function focusMenu() {
    const firstProduct = document.querySelector<HTMLButtonElement>(".product-card");
    firstProduct?.focus();
    firstProduct?.scrollIntoView({ block: "nearest" });
  }
  function closeToMenu(event: Event) {
    if (!focusMenuOnClose.current) return;
    event.preventDefault();
    focusMenuOnClose.current = false;
    focusMenu();
  }
  function browseMenu() {
    focusMenuOnClose.current = heldOpen || cartOpen;
    setHeldOpen(false);
    setCartOpen(false);
    setScreen("sell");
    setSearch("");
    setCategory("all");
    if (!focusMenuOnClose.current) requestAnimationFrame(focusMenu);
  }
  const browseAction = { label: t("ជ្រើសមុខទំនិញ", "Browse menu"), onClick: browseMenu, icon: <ShoppingBag size={18}/> };
  const cartContent = (
    <>
      <div className="cart-heading">
        <div>
          <span className="eyebrow">
            {t("ការកុម្ម៉ង់បច្ចុប្បន្ន", "CURRENT ORDER")}
          </span>
          <h2>
            {t("កន្ត្រករបស់អ្នក", "Your cart")}{" "}
            <span className="count">{itemCount}</span>
          </h2>
        </div>
        <button
          className="d-btn d-btn-ghost d-btn-square icon-button"
          title={t("រក្សាទុកកន្ត្រក", "Hold cart")}
          aria-label="Hold cart"
          disabled={!site.cart.lines.length}
          onClick={() => hold()}
        >
          <Pause size={19} />
        </button>
      </div>
      {site.cart.lines.length ? (
        <>
          <div className="cart-lines">
            {site.cart.lines.map((line) => {
              const amounts = lineAmounts(
                line,
                site.cart.receiptPercent,
                state.config,
              );
              return (
                <div className="cart-line" key={line.id}>
                  <div className="cart-thumb">
                    <FoodArt food={line.product.food} />
                  </div>
                  <div className="cart-line-body">
                    <button
                      className="line-title"
                      onClick={() => setEditor({ product: line.product, line })}
                    >
                      {lang === "km" ? line.product.km : line.product.name}
                      <ChevronRight size={13} />
                    </button>
                    <small>
                      {lang === "km"
                        ? line.product.variantKm
                        : line.product.variant}
                    </small>
                    <span className="modifier-summary">
                      {line.sauce && t(...sauceNames[line.sauce])}
                      {line.extra && ` · + ${t(...sauceNames[line.extra])}`}
                    </span>
                    {line.free && (
                      <span className="free-tag">
                        <Gift size={11} />
                        {t("ឥតគិតថ្លៃ", "Complimentary")}
                      </span>
                    )}
                    <div className="line-bottom">
                      <Quantity
                        value={line.qty}
                        onChange={(qty) => changeQty(line, qty)}
                      />
                      <strong>{money(amounts.net)}</strong>
                    </div>
                  </div>
                  <button
                    className="remove-line"
                    aria-label={t("លុបមុខទំនិញ", "Remove item")}
                    onClick={() =>
                      updateCart((cart) => ({
                        ...cart,
                        lines: cart.lines.filter((item) => item.id !== line.id),
                      }))
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="cart-footer">
            <button
              className="d-btn d-btn-outline button secondary mobile-hold-button full"
              onClick={() => {
                hold();
                setCartOpen(false);
              }}
            >
              <Pause size={16} />
              {t("រក្សាទុក និងចាប់ផ្ដើមថ្មី", "Hold & start fresh")}
            </button>
            <div className="receipt-discount">
              <span>
                <Gift size={15} />
                {t("បញ្ចុះតម្លៃវិក្កយបត្រ", "Receipt discount")}
              </span>
              <SelectField
                aria-label="Receipt discount"
                value={site.cart.receiptPercent}
                onChange={(event) =>
                  updateCart((cart) => ({
                    ...cart,
                    receiptPercent: Number(event.target.value),
                  }))
                }
              >
                {Array.from(new Set([0, 5, 10, state.config.receiptMax]))
                  .sort((a, b) => a - b)
                  .filter((value) => value <= state.config.receiptMax)
                  .map((value) => (
                    <option key={value} value={value}>
                      {value}%
                    </option>
                  ))}
              </SelectField>
            </div>
            <div className="summary-row">
              <span>{t("តម្លៃសរុបដើម", "Subtotal")}</span>
              <span>{money(totals.gross)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="summary-row discount">
                <span>{t("បញ្ចុះតម្លៃ", "Discounts")}</span>
                <span>−{money(totals.discount)}</span>
              </div>
            )}
            {totals.rounding !== 0 && (
              <div className="summary-row">
                <span>{t("ការបង្គត់", "Rounding")}</span>
                <span>
                  {totals.rounding > 0 ? "+" : ""}
                  {money(totals.rounding)}
                </span>
              </div>
            )}
            <div className="total-row">
              <span>{t("សរុប", "Total")}</span>
              <div>
                <strong>{money(totals.total)}</strong>
                <small>
                  ≈ ${(totals.total / state.config.rate).toFixed(2)}
                </small>
              </div>
            </div>
            <button
              className="d-btn d-btn-primary button primary pay-button"
              onClick={() => setPayOpen(true)}
            >
              {totals.total === 0 ? (
                <Gift size={18} />
              ) : (
                <CreditCard size={18} />
              )}
              <span>
                {totals.total === 0
                  ? t("បញ្ចប់ការកុម្ម៉ង់ឥតគិតថ្លៃ", "Complete free order")
                  : t("ពិនិត្យ និងទូទាត់", "Review & pay")}
              </span>
              <ArrowRight size={18} />
            </button>
          </div>
        </>
      ) : (
        <Empty
          title={t("ត្រៀមសម្រាប់ការកុម្ម៉ង់ថ្មី", "Ready for a fresh order")}
          action={browseAction}
          body={t(
            "ជ្រើសមុខទំនិញពីបញ្ជីដើម្បីចាប់ផ្ដើម",
            "Choose something from the menu to get started.",
          )}
        />
      )}
    </>
  );
  return (
    <div className="app pos-app">
      <Header
        app="POS"
        site={state.site}
        sites={siteNames}
        onSite={switchSite}
      />
      <DemoBanner />
      {!online && (
        <div className="notice">
          <WifiOff size={16} />
          {t(
            "គ្មានអ៊ីនធឺណិត · ការសាកល្បងរក្សាទុកលើឧបករណ៍នេះ",
            "Offline · preview data stays on this device",
          )}
        </div>
      )}
      {storageError && (
        <div className="notice danger" role="alert">
          {t(
            "មិនអាចរក្សាទុកបាន។ កុំបិទកម្មវិធី។",
            "Storage is full. Changes were not saved.",
          )}
        </div>
      )}
      <div className="pos-workspace">
        <main className="pos-main">
          {screen === "sell" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {t("សួស្ដី សុខា", "HELLO, SOKHA")}{" "}
                    <span className="sun">☀</span>
                  </div>
                  <h1>{t("តោះចាប់ផ្ដើមលក់", "Let’s serve something good.")}</h1>
                  <p>
                    {t(
                      "មុខម្ហូបឆ្ងាញ់ៗ ការកុម្ម៉ង់ងាយៗ",
                      "Good bites. Easy orders.",
                    )}
                  </p>
                </div>
                <Status>{t("វេនកំពុងដំណើរការ", "Shift open")}</Status>
              </div>
              <div className="catalog-tools">
                <label className="search-box">
                  <Search size={18} />
                  <input
                    aria-label={t("ស្វែងរកមុខទំនិញ", "Search the menu")}
                    placeholder={t("ស្វែងរកមុខទំនិញ…", "Search the menu…")}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <button
                  className="d-btn d-btn-outline button secondary held-button"
                  onClick={() => hold(true)}
                >
                  <Pause size={16} />
                  {t("កន្ត្រករក្សាទុក", "Held carts")}
                  <span className="count">{site.held.length}</span>
                </button>
              </div>
              <div className="category-tabs">
                {[
                  ["all", "ទាំងអស់", "All bites"],
                  ["dumplings", "គាវ", "Dumplings"],
                  ["meatballs", "ប្រហិត", "Meatballs"],
                  ["tea", "ភេសជ្ជៈ", "Drinks"],
                  ["frozen", "ក្លាសេ", "Frozen"],
                ].map(([key, km, en]) => (
                  <button
                    key={key}
                    className={category === key ? "active" : ""}
                    onClick={() => setCategory(key)}
                  >
                    {t(km, en)}
                  </button>
                ))}
              </div>
              <div className="menu-label">
                <h2>{t("មុខម្ហូប", "The menu")}</h2>
                <span>
                  {filtered.length} {t("មុខ", "items")}
                </span>
              </div>
              <div className="product-grid">
                {filtered.map((product) => (
                  <button
                    className="d-card product-card"
                    key={product.id}
                    onClick={() => setEditor({ product })}
                  >
                    <FoodArt food={product.food} />
                    <div className="product-info">
                      <h3>{lang === "km" ? product.km : product.name}</h3>
                      <p>
                        {lang === "km" ? product.variantKm : product.variant}
                      </p>
                      <div className="product-bottom">
                        <strong>{money(product.price)}</strong>
                        <span className="add-circle">
                          <Plus size={18} />
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {!filtered.length && (
                <Empty
                  title={search.trim() || category !== "all" ? t("មិនមានមុខទំនិញ", "No matching bites") : t("មិនទាន់មានមុខទំនិញសម្រាប់លក់", "The menu is getting ready")}
                  action={search.trim() || category !== "all" ? { label: t("សម្អាតតម្រង", "Clear filters"), onClick: () => { setSearch(""); setCategory("all"); }, icon: <Search size={18}/> } : undefined}
                  body={t(
                    search.trim() || category !== "all" ? "សាកល្បងពាក្យស្វែងរកផ្សេង" : "មុខទំនិញសម្រាប់លក់នឹងបង្ហាញនៅទីនេះ ពេលបានរៀបចំម៉ឺនុយ។",
                    search.trim() || category !== "all" ? "Try another search or category." : "Sellable items will appear here once the menu is set up.",
                  )}
                />
              )}
              <div className="catalog-note">
                <Gift size={16} />
                <span>
                  {t(
                    "គ្រប់គ្រងមុខទំនិញឥតគិតថ្លៃតាមចំនួនឯកតាមូលដ្ឋាន",
                    "Complimentary items use the daily base-unit allowance.",
                  )}
                </span>
              </div>
            </>
          ) : screen === "invoices" ? (
            <>
              <PageTitle
                eyebrow={t("ការកុម្ម៉ង់របស់ទីតាំង", "SITE ORDERS")}
                title={t("វិក្កយបត្រ", "Invoices")}
                description={t(
                  "ការកុម្ម៉ង់ដែលបានបញ្ចប់ និងរក្សាទុក",
                  "Completed orders and carts waiting for you.",
                )}
              />
              <button
                className="d-card list-card held-list-link"
                onClick={() => hold(true)}
              >
                <div className="list-icon">
                  <Pause size={22} />
                </div>
                <div>
                  <strong>{t("កន្ត្រករក្សាទុក", "Held carts")}</strong>
                  <small>
                    {site.held.length}{" "}
                    {t("ការកុម្ម៉ង់កំពុងរង់ចាំ", "orders waiting")}
                  </small>
                </div>
                <ChevronRight size={18} />
              </button>
              <div className="section-title">
                <h2>{t("ប្រវត្តិវិក្កយបត្រ", "Invoice history")}</h2>
                <span>{site.invoices.length}</span>
              </div>
              {site.invoices.length ? (
                site.invoices.map((invoice) => (
                  <button
                    className="d-card list-card"
                    key={invoice.id}
                    onClick={() => setDetail(invoice)}
                  >
                    <div className="list-icon">
                      <ReceiptText size={22} />
                    </div>
                    <div className="grow">
                      <strong>{orderName(invoice)}</strong>
                      <small>
                        {new Date(invoice.completed).toLocaleTimeString(
                          lang === "km" ? "km-KH" : "en-US",
                          { hour: "2-digit", minute: "2-digit" },
                        )}{" "}
                        ·{" "}
                        {invoice.lines.reduce((sum, line) => sum + line.qty, 0)}{" "}
                        {t("មុខ", "items")}
                      </small>
                    </div>
                    <div className="align-right">
                      <strong>{money(invoice.total)}</strong>
                      <Status
                        tone={invoice.status === "paid" ? "green" : "gray"}
                      >
                        {invoice.status === "paid"
                          ? t("បានទូទាត់", "Paid")
                          : t("បានបោះបង់", "Cancelled")}
                      </Status>
                    </div>
                  </button>
                ))
              ) : (
                <Empty
                  title={t("មិនទាន់មានវិក្កយបត្រ", "A fresh start")}
                  action={{ ...browseAction, label: t("ចាប់ផ្ដើមការកុម្ម៉ង់", "Take an order") }}
                  body={t(
                    "ការកុម្ម៉ង់ដែលបានបញ្ចប់នឹងបង្ហាញនៅទីនេះ",
                    "Completed sample orders will appear here.",
                  )}
                />
              )}
            </>
          ) : screen === "shift" ? (
            <ShiftView
              site={site}
              rate={state.config.rate}
              onCalculator={() => setCalculator(true)}
              onWithdraw={() => setWithdraw(true)}
              online={online}
            />
          ) : (
            <>
              <PageTitle
                eyebrow="ONEBITE POS"
                title={t("ការកំណត់ និងជំនួយ", "A little more")}
                description={t(
                  "ភាសា ឧបករណ៍ និងការកំណត់សាកល្បង",
                  "Your preferences and sample configuration.",
                )}
              />
              <div className="d-card panel">
                <div className="profile-row">
                  <div className="avatar large-avatar">S</div>
                  <div>
                    <h3>Sokha</h3>
                    <p>
                      {t("អ្នកគិតលុយ", "Cashier")} · {siteNames[state.site]}
                    </p>
                  </div>
                  <Status>{t("សាកល្បង", "Preview")}</Status>
                </div>
                <p className="muted">
                  {t(
                    "ចំណុចប្រទាក់សាកល្បង។ គណនី និងទិន្នន័យពិតនឹងភ្ជាប់នៅដំណាក់កាលបន្ទាប់។",
                    "UI preview. Real accounts and shared data will be connected in the next milestone.",
                  )}
                </p>
              </div>
              <div className="d-card panel">
                <h2>{t("ការកំណត់សាកល្បង", "Preview settings")}</h2>
                <Toggle
                  label={t(
                    "អនុញ្ញាតបំបែកការទូទាត់",
                    "Allow Cash / QR split payments",
                  )}
                  checked={state.config.split}
                  onChange={(split) =>
                    setState((old) => ({
                      ...old,
                      config: { ...old.config, split },
                    }))
                  }
                />
                <div className="detail-row">
                  <span>{t("អត្រាប្ដូរប្រាក់", "Exchange rate")}</span>
                  <strong>$1 = {money(state.config.rate)}</strong>
                </div>
                <div className="detail-row">
                  <span>{t("ការបង្គត់", "Invoice rounding")}</span>
                  <strong>100៛</strong>
                </div>
                <button
                  className="d-btn d-btn-outline button secondary"
                  onClick={() => setCalculator(true)}
                >
                  <Calculator size={17} />
                  {t("គណនាប្រាក់", "Cash calculator")}
                </button>
              </div>
              <button
                className="d-btn d-btn-outline button secondary"
                onClick={() => {
                  if (
                    confirm(
                      t(
                        "លុបទិន្នន័យសាកល្បងទាំងអស់?",
                        "Reset all sample POS data?",
                      ),
                    )
                  ) {
                    setState(initial());
                    setToast(t("បានកំណត់ឡើងវិញ", "Sample data reset"));
                  }
                }}
              >
                <RotateCcw size={16} />
                {t("កំណត់ទិន្នន័យគំរូឡើងវិញ", "Reset sample data")}
              </button>
            </>
          )}
        </main>
        {screen === "sell" && (
          <aside className="cart-panel">{cartContent}</aside>
        )}
      </div>
      <nav className="bottom-nav" aria-label="POS navigation">
        {nav.map((item) => (
          <button
            key={item.id}
            className={screen === item.id ? "active" : ""}
            onClick={() => {
              setScreen(item.id);
              setCartOpen(false);
            }}
          >
            <item.icon size={21} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {screen === "sell" && site.cart.lines.length > 0 && !cartOpen && (
        <button
          className="mobile-cart-button"
          onClick={() => setCartOpen(true)}
        >
          <ShoppingBag size={20} />
          <span>
            {t("មើលកន្ត្រក", "View cart")}{" "}
            <span className="cart-pill">{itemCount}</span>
          </span>
          <strong>{money(totals.total)}</strong>
          <ChevronRight size={18} />
        </button>
      )}
      {cartOpen && (
        <Modal
          title={t("កន្ត្រករបស់អ្នក", "Your cart")}
          onClose={() => setCartOpen(false)}
          onCloseAutoFocus={closeToMenu}
        >
          <div className="mobile-cart-content">{cartContent}</div>
        </Modal>
      )}
      {editor && (
        <ItemEditor
          product={editor.product}
          existing={editor.line}
          config={state.config}
          carts={[site.cart, ...site.held]}
          invoices={site.invoices}
          onClose={() => setEditor(null)}
          onSave={addLine}
        />
      )}{" "}
      {heldOpen && (
        <Modal
          title={t("កន្ត្រករក្សាទុក", "Held carts")}
          onClose={() => setHeldOpen(false)}
          onCloseAutoFocus={closeToMenu}
        >
          {site.held.length ? (
            site.held.map((cart) => (
              <div className="held-row" key={cart.id}>
                <button
                  className="held-resume"
                  onClick={() => {
                    updateSite((old) => ({
                      ...old,
                      cart,
                      held: old.held.filter((item) => item.id !== cart.id),
                    }));
                    setHeldOpen(false);
                    setScreen("sell");
                    setCartOpen(
                      window.matchMedia("(max-width: 850px)").matches,
                    );
                  }}
                >
                  <span className="list-icon">
                    <Pause size={20} />
                  </span>
                  <span>
                    <strong>{orderName(cart)}</strong>
                    <small>
                      {cart.lines.reduce((sum, line) => sum + line.qty, 0)}{" "}
                      {t("មុខ", "items")} ·{" "}
                      {money(cartAmounts(cart, state.config).total)}
                    </small>
                  </span>
                  <ChevronRight size={18} />
                </button>
                <button
                  className="d-btn d-btn-ghost d-btn-square icon-button"
                  aria-label="Cancel held invoice"
                  onClick={() => {
                    setCancel(cart);
                    setReason("");
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))
          ) : (
            <Empty
              title={t("មិនមានកន្ត្រករក្សាទុក", "Nothing on hold")}
              action={browseAction}
              body={t(
                "រក្សាទុកកន្ត្រកដើម្បីបន្តនៅពេលក្រោយ",
                "Hold a cart to come back to it later.",
              )}
            />
          )}
        </Modal>
      )}
      {cancel && (
        <Modal
          title={t("បោះបង់វិក្កយបត្រ", "Cancel unpaid invoice")}
          onClose={() => setCancel(null)}
        >
          <p className="muted">
            {t(
              "ចំនួនមុខទំនិញឥតគិតថ្លៃដែលបានកក់ នឹងត្រូវបានស្ដារឡើងវិញ។",
              "Reserved complimentary allowance will be restored.",
            )}
          </p>
          <Field label={t("មូលហេតុ", "Reason")}>
            <textarea className="d-textarea"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t(
                "សូមបញ្ចូលមូលហេតុ",
                "Why is this order being cancelled?",
              )}
            />
          </Field>
          <button
            className="d-btn d-btn-error button danger-button full"
            disabled={!reason.trim()}
            onClick={() => {
              const invoice: Invoice = {
                ...cancel,
                status: "cancelled",
                total: 0,
                cash: 0,
                qr: 0,
                reason: reason.trim(),
                completed: new Date().toISOString(),
              };
              updateSite((old) => ({
                ...old,
                held: old.held.filter((cart) => cart.id !== cancel.id),
                invoices: [invoice, ...old.invoices],
              }));
              setCancel(null);
              setToast(t("បានបោះបង់វិក្កយបត្រ", "Unpaid invoice cancelled"));
            }}
          >
            {t("បញ្ជាក់ការបោះបង់", "Confirm cancellation")}
          </button>
        </Modal>
      )}
      {payOpen && (
        <Payment
          cart={site.cart}
          config={state.config}
          onClose={() => setPayOpen(false)}
          onPay={paid}
        />
      )}{" "}
      {detail && (
        <InvoiceDetail
          invoice={detail}
          config={state.config}
          onClose={() => setDetail(null)}
          onReference={(reference) => {
            updateSite((old) => ({
              ...old,
              invoices: old.invoices.map((invoice) =>
                invoice.id === detail.id ? { ...invoice, reference } : invoice,
              ),
            }));
            setDetail({ ...detail, reference });
          }}
        />
      )}
      {calculator && (
        <CashCalculator
          rate={state.config.rate}
          onClose={() => setCalculator(false)}
        />
      )}{" "}
      {withdraw && (
        <Withdrawal
          balance={
            100000 +
            site.invoices
              .filter((invoice) => invoice.status === "paid")
              .reduce((sum, invoice) => sum + invoice.cash, 0) -
            site.withdrawals.reduce((sum, row) => sum + row.amount, 0)
          }
          onClose={() => setWithdraw(false)}
          onSave={(amount, reason) => {
            updateSite((old) => ({
              ...old,
              withdrawals: [
                ...old.withdrawals,
                { id: id(), amount, reason, time: new Date().toISOString() },
              ],
            }));
            setWithdraw(false);
            setToast(
              t("បានកត់ត្រាការដកប្រាក់សាកល្បង", "Sample withdrawal recorded"),
            );
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
function ItemEditor({
  product,
  existing,
  config,
  carts,
  invoices,
  onClose,
  onSave,
}: {
  product: Product;
  existing?: Line;
  config: Config;
  carts: Cart[];
  invoices: Invoice[];
  onClose: () => void;
  onSave: (line: Line) => void;
}) {
  const { t, lang } = useLanguage();
  const [qty, setQty] = useState(existing?.qty ?? 1);
  const [sauce, setSauce] = useState<Sauce | null>(
    existing?.sauce ??
      (product.sauces.includes(product.defaultSauce)
        ? product.defaultSauce
        : (product.sauces[0] ?? null)),
  );
  const [extra, setExtra] = useState<Sauce | null>(existing?.extra ?? null);
  const [percent, setPercent] = useState(existing?.percent ?? 0);
  const [fixed, setFixed] = useState(existing?.fixed ?? 0);
  const [free, setFree] = useState(existing?.free ?? false);
  const group = config.groups.find((group) => group.id === product.group);
  const remaining = group ? available(group, carts, invoices, existing?.id) : 0;
  const required = qty * product.units;
  const insufficient = free && required > remaining;
  const draft: Line = {
    id: existing?.id ?? "new",
    product,
    qty,
    sauce,
    extra,
    percent,
    fixed,
    free,
  };
  const amounts = lineAmounts(draft, 0, config);
  return (
    <Modal
      title={
        existing
          ? t("កែប្រែមុខទំនិញ", "Customize item")
          : t("បន្ថែមមុខទំនិញ", "Make it yours")
      }
      onClose={onClose}
    >
      <div className="editor-product">
        <FoodArt food={product.food} />
        <div>
          <h3>{lang === "km" ? product.km : product.name}</h3>
          <p>{lang === "km" ? product.variantKm : product.variant}</p>
          <strong>{money(product.price)}</strong>
        </div>
      </div>
      {product.sauces.length > 0 && (
        <>
          <div className="section-title">
            <h3>{t("ជ្រើសទឹកជ្រលក់", "Choose your sauce")}</h3>
            <span>{t("ត្រូវជ្រើស", "Required")}</span>
          </div>
          <div className="option-grid">
            {product.sauces.map((option) => (
              <button
                key={option}
                className={`option ${sauce === option ? "selected" : ""}`}
                onClick={() => setSauce(option)}
              >
                <span>{t(...sauceNames[option])}</span>
                <small>
                  {config.saucePrices[option]
                    ? `+${money(config.saucePrices[option])}`
                    : t("រួមបញ្ចូល", "Included")}
                </small>
                {sauce === option && <Check size={14} />}
              </button>
            ))}
          </div>
          <div className="section-title">
            <h3>{t("ទឹកជ្រលក់បន្ថែម", "Extra sauce")}</h3>
            <span>{t("ជម្រើស", "Optional")}</span>
          </div>
          <div className="option-grid extras">
            <button
              className={`option ${!extra ? "selected" : ""}`}
              onClick={() => setExtra(null)}
            >
              {t("មិនបន្ថែម", "No extra")}
            </button>
            {product.sauces.map((option) => (
              <button
                key={option}
                className={`option ${extra === option ? "selected" : ""}`}
                onClick={() => setExtra(option)}
              >
                <span>{t(...sauceNames[option])}</span>
                <small>+{money(config.extraPrices[option])}</small>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="editor-quantity">
        <h3>{t("ចំនួន", "Quantity")}</h3>
        <Quantity value={qty} onChange={setQty} />
      </div>
      <details
        className="discount-details"
        open={Boolean(existing?.percent || existing?.fixed || existing?.free)}
      >
        <summary>
          <Gift size={16} />
          {t("បញ្ចុះតម្លៃ និងឥតគិតថ្លៃ", "Discounts & complimentary")}
        </summary>
        <div className="form-grid">
          <Field label={t("បញ្ចុះតម្លៃ (%)", "Item discount (%)")}>
            <input
              type="number"
              min="0"
              max={product.maxPercent}
              value={percent}
              onChange={(event) =>
                setPercent(
                  Math.min(product.maxPercent, positive(event.target.value)),
                )
              }
            />
          </Field>
          <Field
            label={t("បញ្ចុះតម្លៃក្នុងមួយឯកតា (៛)", "Discount per unit (KHR)")}
          >
            <input
              type="number"
              min="0"
              max={product.maxFixed}
              step="100"
              value={fixed}
              onChange={(event) =>
                setFixed(
                  Math.min(product.maxFixed, positive(event.target.value)),
                )
              }
            />
          </Field>
        </div>
        <p className="helper">
          {t("កម្រិតអតិបរមា", "Hard limits")}: {product.maxPercent}% ·{" "}
          {money(product.maxFixed)} {t("ក្នុងមួយឯកតា", "per sold unit")}
        </p>
        <Toggle
          label={t(
            "មុខទំនិញឥតគិតថ្លៃ (រួមបញ្ចូលទាំងការបន្ថែម)",
            "Complimentary, including all extras",
          )}
          checked={free}
          onChange={setFree}
        />
        <p className={`allowance-message ${insufficient ? "error" : ""}`}>
          {t("នៅសល់", "Remaining")}: {remaining} · {t("ត្រូវការ", "Needed")}:{" "}
          {required}{" "}
          {insufficient &&
            ` · ${t("មិនគ្រប់គ្រាន់", "Insufficient allowance")}`}
        </p>
      </details>
      <div className="modal-action">
        <div>
          <small>{t("តម្លៃមុខទំនិញ", "Item total")}</small>
          <strong>{money(amounts.net)}</strong>
        </div>
        <button
          className="d-btn d-btn-primary button primary"
          disabled={insufficient || (product.sauces.length > 0 && !sauce)}
          onClick={() => onSave({ ...draft, id: existing?.id ?? id() })}
        >
          <Plus size={18} />
          {existing
            ? t("រក្សាទុក", "Save changes")
            : t("បន្ថែមទៅកន្ត្រក", "Add to cart")}
        </button>
      </div>
    </Modal>
  );
}
function Payment({
  cart,
  config,
  onClose,
  onPay,
}: {
  cart: Cart;
  config: Config;
  onClose: () => void;
  onPay: (cash: number, qr: number, reference?: string) => void;
}) {
  const { t } = useLanguage();
  const totals = cartAmounts(cart, config);
  const [method, setMethod] = useState<"cash" | "qr" | "split">("cash");
  const [cash, setCash] = useState(totals.total);
  const [reference, setReference] = useState<string>();
  const qr = totals.total - cash;
  return (
    <Modal
      title={
        totals.total === 0
          ? t("ការកុម្ម៉ង់ឥតគិតថ្លៃ", "Complete free order")
          : t("ពិនិត្យការទូទាត់", "Review payment")
      }
      onClose={onClose}
    >
      <div className="payment-total">
        <span>{t("ចំនួនត្រូវទូទាត់", "Amount due")}</span>
        <strong>{money(totals.total)}</strong>
        <small>≈ ${(totals.total / config.rate).toFixed(2)} USD</small>
      </div>
      <div className="payment-order">
        {cart.lines.map((line) => (
          <div key={line.id}>
            <span>
              {line.qty} × {t(line.product.km, line.product.name)}
              <small>{t(line.product.variantKm, line.product.variant)}</small>
            </span>
            <strong>
              {money(lineAmounts(line, cart.receiptPercent, config).net)}
            </strong>
          </div>
        ))}
        {totals.rounding !== 0 && (
          <div>
            <span>{t("ការបង្គត់", "Rounding")}</span>
            <strong>
              {totals.rounding > 0 ? "+" : ""}
              {money(totals.rounding)}
            </strong>
          </div>
        )}
      </div>
      {totals.total > 0 && (
        <>
          <div className="section-title">
            <h3>{t("វិធីទូទាត់", "Payment method")}</h3>
          </div>
          <div className="payment-methods">
            {[
              { id: "cash", icon: Banknote, label: t("សាច់ប្រាក់", "Cash") },
              { id: "qr", icon: QrCode, label: t("ទូទាត់ QR", "QR Payment") },
              ...(config.split
                ? [
                    {
                      id: "split",
                      icon: CreditCard,
                      label: t("បំបែក", "Split"),
                    },
                  ]
                : []),
            ].map((option) => (
              <button
                className={`option ${method === option.id ? "selected" : ""}`}
                key={option.id}
                onClick={() => setMethod(option.id as typeof method)}
              >
                <option.icon size={23} />
                {option.label}
              </button>
            ))}
          </div>
          {method === "split" && (
            <div className="split-form">
              <Field label={t("ចំនួនសាច់ប្រាក់ (៛)", "Cash amount (KHR)")}>
                <input
                  type="number"
                  min="0"
                  max={totals.total}
                  step="100"
                  value={cash}
                  onChange={(event) =>
                    setCash(
                      Math.min(totals.total, positive(event.target.value)),
                    )
                  }
                />
              </Field>
              <div className="detail-row">
                <span>QR Payment</span>
                <strong>{money(qr)}</strong>
              </div>
            </div>
          )}
          {method !== "cash" && (
            <>
              <p className="helper">
                {t(
                  "បញ្ជាក់ការទូទាត់ក្នុងកម្មវិធីធនាគារ។ ប្រព័ន្ធនេះកត់ត្រាតែការទូទាត់ប៉ុណ្ណោះ។",
                  "Confirm payment in the bank app. This records payment without bank verification.",
                )}
              </p>
              <PhotoInput value={reference} onChange={setReference} />
            </>
          )}
        </>
      )}
      <p className="payment-warning">
        {t(
          "សូមពិនិត្យមុនបញ្ជាក់។ វិក្កយបត្រដែលបានទូទាត់មិនអាចបោះបង់ ឬសងប្រាក់បានទេ។",
          "Review before confirming. Paid invoices cannot be cancelled or refunded.",
        )}
      </p>
      <button
        className="d-btn d-btn-primary button primary full"
        onClick={() =>
          onPay(
            totals.total === 0
              ? 0
              : method === "cash"
                ? totals.total
                : method === "split"
                  ? cash
                  : 0,
            totals.total === 0
              ? 0
              : method === "qr"
                ? totals.total
                : method === "split"
                  ? qr
                  : 0,
            reference,
          )
        }
      >
        <Check size={18} />
        {totals.total === 0
          ? t("បញ្ចប់ការកុម្ម៉ង់ឥតគិតថ្លៃ", "Complete free order")
          : t("បញ្ជាក់ការទូទាត់", "Confirm payment")}
      </button>
    </Modal>
  );
}
function PhotoInput({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLanguage();
  const [error, setError] = useState("");
  return (
    <div className="photo-input">
      {value && <img src={value} alt="QR payment reference" />}
      <label className="d-btn d-btn-outline button secondary">
        <ImagePlus size={17} />
        {t("បន្ថែមរូបភាពយោង (ជម្រើស)", "Add reference photo (optional)")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 1_000_000) {
              setError(
                t(
                  "សូមជ្រើសរូបភាពតូចជាង 1 MB សម្រាប់សាកល្បង",
                  "Choose an image under 1 MB for this preview.",
                ),
              );
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              onChange(String(reader.result));
              setError("");
            };
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
function InvoiceDetail({
  invoice,
  config,
  onClose,
  onReference,
}: {
  invoice: Invoice;
  config: Config;
  onClose: () => void;
  onReference: (value: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <Modal
      title={`${t("វិក្កយបត្រ", "Invoice")} ${orderName(invoice)}`}
      onClose={onClose}
    >
      <Status tone={invoice.status === "paid" ? "green" : "gray"}>
        {invoice.status === "paid"
          ? t("បានទូទាត់ · បានចាក់សោ", "Paid · locked")
          : t("បានបោះបង់", "Cancelled")}
      </Status>
      <div className="payment-order">
        {invoice.lines.map((line) => (
          <div key={line.id}>
            <span>
              {line.qty} × {t(line.product.km, line.product.name)}
              <small>
                {t(line.product.variantKm, line.product.variant)}
                {line.sauce && ` · ${t(...sauceNames[line.sauce])}`}
                {line.extra && ` · + ${t(...sauceNames[line.extra])}`}
              </small>
            </span>
            <strong>
              {money(lineAmounts(line, invoice.receiptPercent, config).net)}
            </strong>
          </div>
        ))}
      </div>
      <div className="total-row">
        <span>{t("សរុប", "Total")}</span>
        <strong>{money(invoice.total)}</strong>
      </div>
      {invoice.cash > 0 && (
        <div className="detail-row">
          <span>{t("សាច់ប្រាក់", "Cash")}</span>
          <strong>{money(invoice.cash)}</strong>
        </div>
      )}
      {invoice.qr > 0 && (
        <>
          <div className="detail-row">
            <span>QR Payment</span>
            <strong>{money(invoice.qr)}</strong>
          </div>
          <PhotoInput value={invoice.reference} onChange={onReference} />
        </>
      )}
      {invoice.reason && (
        <p className="helper">
          {t("មូលហេតុ", "Reason")}: {invoice.reason}
        </p>
      )}
    </Modal>
  );
}
function ShiftView({
  site,
  rate,
  onCalculator,
  onWithdraw,
  online,
}: {
  site: SiteState;
  rate: number;
  onCalculator: () => void;
  onWithdraw: () => void;
  online: boolean;
}) {
  const { t } = useLanguage();
  const paid = site.invoices.filter((invoice) => invoice.status === "paid");
  const cash = paid.reduce((sum, invoice) => sum + invoice.cash, 0);
  const qr = paid.reduce((sum, invoice) => sum + invoice.qr, 0);
  const withdrawals = site.withdrawals.reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  const balance = 100000 + cash - withdrawals;
  return (
    <>
      <PageTitle
        eyebrow={t("សាច់ប្រាក់ និងការទទួលខុសត្រូវ", "CASH & CUSTODY")}
        title={t("វេនបច្ចុប្បន្ន", "Your shift at a glance")}
        description={t(
          "តាមដានសាច់ប្រាក់ពីបើកវេន ដល់ផ្ទេរវេន",
          "From opening cash to the next handover.",
        )}
      />
      <div className="shift-hero">
        <div>
          <Status>{t("វេនបើក · សាកល្បង", "Open shift · sample")}</Status>
          <p>{t("សមតុល្យសាច់ប្រាក់រំពឹងទុក", "Expected cash balance")}</p>
          <h2>{money(balance)}</h2>
          <small>
            ≈ ${(balance / rate).toFixed(2)} · {t("អ្នកកាន់ប្រាក់", "Held by")}{" "}
            Sokha
          </small>
        </div>
        <Wallet size={60} />
      </div>
      <div className="stats-grid">
        <Stat
          label={t("ប្រាក់បើកវេន", "Opening cash")}
          value={money(100000)}
          detail={t("ពីវេនមុន · ទិន្នន័យគំរូ", "Previous shift · sample")}
        />
        <Stat label={t("ការលក់សាច់ប្រាក់", "Cash sales")} value={money(cash)} />
        <Stat label="QR Payment" value={money(qr)} />
        <Stat
          label={t("ប្រាក់ដកចេញ", "Withdrawals")}
          value={money(withdrawals)}
        />
      </div>
      <div className="action-grid">
        <button className="d-btn d-btn-outline button secondary" onClick={onCalculator}>
          <Calculator size={18} />
          {t("គណនាប្រាក់", "Cash calculator")}
        </button>
        <button
          className="d-btn d-btn-outline button secondary"
          disabled={!online}
          onClick={onWithdraw}
        >
          <ArrowUpRight size={18} />
          {t("សាកល្បងដកប្រាក់", "Preview withdrawal")}
        </button>
      </div>
      <div className="d-card panel">
        <h2>{t("ចលនាសាច់ប្រាក់", "Cash movements")}</h2>
        {site.withdrawals.length ? (
          site.withdrawals.map((row) => (
            <div className="detail-row" key={row.id}>
              <div>
                <strong>{row.reason}</strong>
                <small>
                  Dara + Sokha · {t("បានបញ្ជាក់ពីរនាក់", "Both confirmed")}
                </small>
              </div>
              <strong>−{money(row.amount)}</strong>
            </div>
          ))
        ) : (
          <p className="muted">
            {t(
              "មិនទាន់មានការដកប្រាក់ក្នុងវេននេះ",
              "No sample withdrawals this shift.",
            )}
          </p>
        )}
        <div className="helper-box">
          <Clock3 size={18} />
          <span>
            {t(
              "ការផ្ទេរវេន និងការបើកវេនពិត នឹងបន្ថែមក្នុងដំណាក់កាលគ្រប់គ្រងសាច់ប្រាក់។",
              "Actual shift opening and dual-confirmed handovers are part of the cash-management milestone.",
            )}
          </span>
        </div>
      </div>
    </>
  );
}
function CashCalculator({
  rate,
  onClose,
}: {
  rate: number;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [khr, setKhr] = useState("");
  const [usd, setUsd] = useState("");
  const dollars = Math.round((Number(usd) || 0) * 100);
  const total = positive(khr) + Math.round((dollars * rate) / 100);
  return (
    <Modal title={t("គណនាសាច់ប្រាក់", "Cash calculator")} onClose={onClose}>
      <p className="muted">
        {t(
          "បញ្ចូលសាច់ប្រាក់ដែលបានរាប់។ រក្សាទុកតែសរុបសមមូលជារៀល។",
          "Count each currency. Cash records use only the total KHR equivalent.",
        )}
      </p>
      <Field label="KHR">
        <input
          type="number"
          min="0"
          step="100"
          value={khr}
          onChange={(event) => setKhr(event.target.value)}
          placeholder="0"
        />
      </Field>
      <Field label="USD">
        <input
          type="number"
          min="0"
          step="0.01"
          value={usd}
          onChange={(event) => setUsd(event.target.value)}
          placeholder="0.00"
        />
      </Field>
      <div className="payment-total">
        <span>{t("សរុបសមមូល", "Total equivalent")}</span>
        <strong>{money(total)}</strong>
        <small>$1 = {money(rate)}</small>
      </div>
    </Modal>
  );
}
function Withdrawal({
  balance,
  onClose,
  onSave,
}: {
  balance: number;
  onClose: () => void;
  onSave: (amount: number, reason: string) => void;
}) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [owner, setOwner] = useState(false);
  const [holder, setHolder] = useState(false);
  return (
    <Modal
      title={t("ការដកប្រាក់សាកល្បង", "Sample cash withdrawal")}
      onClose={onClose}
    >
      <p className="muted">
        {t(
          "ចំណុចប្រទាក់បញ្ជាក់ពីរនាក់។ នេះមិនមែនជាការផ្ទៀងផ្ទាត់អត្តសញ្ញាណពិតទេ។",
          "Preview of two-person confirmation. These controls do not verify real identities.",
        )}
      </p>
      <Field label={t("ចំនួនដក (៛)", "Withdrawal amount (KHR)")}>
        <input
          type="number"
          min="0"
          max={balance}
          step="100"
          value={amount}
          onChange={(event) =>
            setAmount(Math.min(balance, positive(event.target.value)))
          }
        />
      </Field>
      <Field label={t("មូលហេតុ", "Reason")}>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <Toggle
        label={t(
          "ដារ៉ា · ម្ចាស់ · បញ្ជាក់ការដកប្រាក់",
          "Dara · Owner · confirms withdrawal",
        )}
        checked={owner}
        onChange={setOwner}
      />
      <Toggle
        label={t(
          "សុខា · អ្នកកាន់ប្រាក់ · បញ្ជាក់ការប្រគល់",
          "Sokha · Cash holder · confirms cash given",
        )}
        checked={holder}
        onChange={setHolder}
      />
      <button
        className="d-btn d-btn-primary button primary full"
        disabled={!owner || !holder || amount <= 0 || !reason.trim()}
        onClick={() => onSave(amount, reason.trim())}
      >
        {t("កត់ត្រាការដកប្រាក់សាកល្បង", "Record sample withdrawal")}
      </button>
    </Modal>
  );
}
