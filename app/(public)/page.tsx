"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCopy,
  Leaf,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  Wine,
  X,
} from "lucide-react";
import { useOrders } from "@/contexts/orders-context";
import { ORDER_STATUS_LABELS } from "@/shared/constants";
import type { RomOrder } from "@/shared/types/orders";

/** Menu categories — aligned with SRS / DB `CATEGORIES` (F9). */
const CATEGORIES = [
  { id: "starters", label: "Starters", icon: UtensilsCrossed },
  { id: "mains", label: "Mains", icon: UtensilsCrossed },
  { id: "desserts", label: "Desserts", icon: Sparkles },
  { id: "drinks", label: "Drinks", icon: Wine },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

type MenuItem = {
  id: string;
  categoryId: CategoryId;
  name: string;
  description: string;
  price: number;
  image: string;
};

/**
 * Mock menu — SRS F1 (browse), F10 fields: name, description, price, category.
 * Items are illustrative; prices in INR for display consistency.
 */
const MOCK_MENU: MenuItem[] = [
  {
    id: "itm-001",
    categoryId: "starters",
    name: "Crispy Calamari Rings",
    description:
      "Lightly battered calamari with lemon aioli and microgreens — perfect to share.",
    price: 349,
    image: "/dishes/crispy_calamari_rings.png"
  },
  {
    id: "itm-002",
    categoryId: "starters",
    name: "Roasted Tomato Bruschetta",
    description:
      "Toasted sourdough, slow-roasted tomatoes, basil, garlic, and extra-virgin olive oil.",
    price: 279,
    image: "/dishes/roasted_tomato_bruschetta.png"
  },
  {
    id: "itm-003",
    categoryId: "starters",
    name: "Soup of the Day",
    description:
      "Chef’s seasonal soup served with warm artisan bread. Ask your server for today’s pick.",
    price: 199,
    image: "/dishes/soup_of_the_day.png"
  },
  {
    id: "itm-004",
    categoryId: "mains",
    name: "Gourmet Burger",
    description:
      "Angus patty, aged cheddar, caramelized onion, brioche bun, and house pickles. Served with fries.",
    price: 449,
    image: "/dishes/Gourmet_burger.png"
  },
  {
    id: "itm-005",
    categoryId: "mains",
    name: "Margherita Pizza",
    description:
      "Wood-fired crust, San Marzano tomato, fresh mozzarella, basil, and olive oil (12”).",
    price: 399,
    image: "/dishes/Margherita_Pizza.png"
  },
  {
    id: "itm-006",
    categoryId: "mains",
    name: "Garden Salad",
    description:
      "Mixed greens, cherry tomatoes, cucumber, toasted seeds, and lemon–herb vinaigrette.",
    price: 299,
    image: "/dishes/garden_salad.png"
  },
  {
    id: "itm-007",
    categoryId: "mains",
    name: "Grilled Atlantic Salmon",
    description:
      "Herb-crusted salmon, lemon butter sauce, seasonal vegetables, and herbed rice.",
    price: 649,
    image: "/dishes/Grilled_Atlantic_Salmon.png"
  },
  {
    id: "itm-008",
    categoryId: "mains",
    name: "Creamy Pasta Carbonara",
    description:
      "Spaghetti with egg yolk sauce, pecorino, cracked pepper, and crispy pancetta.",
    price: 379,
    image: "/dishes/Creamy_Pasta_Carbonara.png"
  },
  {
    id: "itm-009",
    categoryId: "desserts",
    name: "Classic Tiramisu",
    description:
      "Espresso-soaked ladyfingers, mascarpone, cocoa — finished tableside when busy.",
    price: 249,
    image: "/dishes/Classic_Tiramisu.png"
  },
  {
    id: "itm-010",
    categoryId: "desserts",
    name: "Chocolate Lava Cake",
    description:
      "Warm dark chocolate center, vanilla bean gelato, and berry compote.",
    price: 299,
    image: "/dishes/Chocolate_Lava_Cake.png"
  },
  {
    id: "itm-011",
    categoryId: "drinks",
    name: "Fresh Mint Lemonade",
    description:
      "House-pressed lemons, mint, light sparkle — refreshing with any main.",
    price: 129,
    image: "/dishes/Fresh_Mint_Lemonade.png"
  },
  {
    id: "itm-012",
    categoryId: "drinks",
    name: "Cold Brew Iced Coffee",
    description:
      "Slow-steeped cold brew over ice; optional oat or dairy on request.",
    price: 159,
    image: "/dishes/Cold_Brew_Iced_Coffee.png"
  },
  {
    id: "itm-013",
    categoryId: "drinks",
    name: "Sparkling Mineral Water",
    description: "750ml bottle — crisp palate cleanser between courses.",
    price: 99,
    image: "/dishes/Sparkling_Mineral_Water.png"
  },
];

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PublicHomePage() {
  const { appendOrder } = useOrders();
  const [activeCategory, setActiveCategory] = useState<CategoryId | "all">(
    "all",
  );
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    token: string;
    orderId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (activeCategory === "all") return MOCK_MENU;
    return MOCK_MENU.filter((i) => i.categoryId === activeCategory);
  }, [activeCategory]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, quantity]) => {
        const item = MOCK_MENU.find((m) => m.id === id);
        if (!item) return null;
        return { item, quantity };
      })
      .filter(Boolean) as { item: MenuItem; quantity: number }[];
  }, [cart]);

  const cartCount = cartLines.reduce((n, l) => n + l.quantity, 0);
  /** Display/cart subtotal aligned with server NUMERIC(10,2) rounding. */
  const cartTotal = useMemo(() => {
    const raw = cartLines.reduce(
      (sum, l) => sum + l.item.price * l.quantity,
      0,
    );
    return Math.round(raw * 100) / 100;
  }, [cartLines]);

  useEffect(() => {
    if (!sidebarOpen && !successInfo) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen, successInfo]);

  function addToCart(itemId: string) {
    setCart((c) => ({ ...c, [itemId]: (c[itemId] ?? 0) + 1 }));
  }

  function setLineQuantity(itemId: string, quantity: number) {
    setCart((c) => {
      const next = { ...c };
      if (quantity <= 0) delete next[itemId];
      else next[itemId] = quantity;
      return next;
    });
  }

  async function placeOrder() {
    if (cartLines.length === 0) return;
    setOrderSubmitting(true);
    setOrderError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: cartLines.map(({ item, quantity }) => ({
            menuItemId: item.id,
            name: item.name,
            quantity,
            unitPrice: item.price,
          })),
        }),
      });
      const data = (await res.json()) as {
        order?: RomOrder;
        error?: string;
        persistence?: "mysql" | "memory";
      };
      if (!res.ok || !data.order) {
        setOrderError(data.error ?? "Could not place order.");
        return;
      }
      if (data.persistence === "memory") {
        console.warn(
          "[ROMS] Order stored in server memory only — not in MySQL. Set DATABASE_URL in roms/.env.local, run `npx prisma migrate deploy`, restart `npm run dev`; then Prisma Studio should show new rows after placing an order.",
        );
      }
      appendOrder(data.order);
      setSuccessInfo({
        token: data.order.trackingToken,
        orderId: data.order.orderId,
      });
      setCart({});
      setSidebarOpen(false);
    } catch {
      setOrderError("Network error. Please try again.");
    } finally {
      setOrderSubmitting(false);
    }
  }

  function dismissSuccess() {
    setSuccessInfo(null);
    setCopied(false);
  }

  async function copyToken() {
    if (!successInfo) return;
    try {
      await navigator.clipboard.writeText(successInfo.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative pb-28">
      {/* Hero */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800/80">
              Restaurant Order Management
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Order fresh from our kitchen
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              Browse by category, add dishes with a tap, and place your order.
              You’ll get a private tracking link to follow status live —{" "}
              <span className="font-medium text-zinc-800">
                {ORDER_STATUS_LABELS.received}
              </span>{" "}
              through{" "}
              <span className="font-medium text-zinc-800">
                {ORDER_STATUS_LABELS.completed}
              </span>{" "}
              (SRS F4).
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-amber-200/80 bg-white/80 px-4 py-2 text-sm text-amber-900 shadow-sm backdrop-blur">
            <Leaf className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <span>No online payment in v1.0 — pay at pickup.</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        {/* Category filter — desktop left rail */}
        <aside className="lg:sticky lg:top-24 lg:w-56 lg:shrink-0">
          <p className="mb-3 hidden text-xs font-semibold uppercase tracking-wider text-zinc-500 lg:block">
            Categories
          </p>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:pb-0">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition lg:w-full lg:rounded-xl lg:text-left ${
                activeCategory === "all"
                  ? "bg-zinc-900 text-white shadow-md"
                  : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              All items
            </button>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition lg:w-full lg:rounded-xl lg:px-3 lg:py-2.5 ${
                    active
                      ? "bg-zinc-900 text-white shadow-md"
                      : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <Icon className="hidden h-4 w-4 opacity-80 sm:block" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Menu grid */}
        <section className="min-w-0 flex-1" aria-label="Menu items">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              {activeCategory === "all"
                ? "Full menu"
                : CATEGORIES.find((c) => c.id === activeCategory)?.label}
            </h2>
            <span className="text-sm text-zinc-500">
              {filteredItems.length}{" "}
              {filteredItems.length === 1 ? "dish" : "dishes"}
            </span>
          </div>

          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item, index) => {
              const gradients = [
                "from-orange-100 to-amber-50",
                "from-emerald-100 to-teal-50",
                "from-violet-100 to-purple-50",
                "from-sky-100 to-blue-50",
                "from-rose-100 to-orange-50",
              ];
              const bg = gradients[index % gradients.length];
              return (
                <li
                  key={item.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-md"
                >
                  <div
                    className={`relative aspect-[4/3] bg-gradient-to-br ${bg}`}
                  >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <UtensilsCrossed
                        className="h-14 w-14 text-white/40 drop-shadow-sm"
                        strokeWidth={1.25}
                        aria-hidden
                      />
                    </div>
                    <div className="absolute bottom-3 right-3">
                      <button
                        type="button"
                        onClick={() => addToCart(item.id)}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg ring-2 ring-white/90 transition hover:scale-105 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                        aria-label={`Add ${item.name} to cart`}
                      >
                        <Plus className="h-5 w-5" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-snug text-zinc-900">
                        {item.name}
                      </h3>
                      <span className="shrink-0 text-sm font-bold text-amber-800">
                        {formatInr(item.price)}
                      </span>
                    </div>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">
                      {item.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Floating cart */}
      {cartCount > 0 && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full bg-zinc-900 px-5 py-3.5 text-white shadow-2xl ring-2 ring-white/20 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          aria-label={`Open cart, ${cartCount} items, total ${formatInr(cartTotal)}`}
        >
          <span className="relative">
            <ShoppingBag className="h-6 w-6" />
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-zinc-900">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-xs font-medium text-zinc-400">
              Your cart
            </span>
            <span className="text-sm font-semibold">{formatInr(cartTotal)}</span>
          </span>
        </button>
      )}

      {/* Cart sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm"
            aria-label="Close cart overlay"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="relative flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <h2
                id="cart-title"
                className="text-lg font-semibold text-zinc-900"
              >
                Your order
              </h2>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Close cart"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cartLines.length === 0 ? (
                <p className="text-sm text-zinc-500">Your cart is empty.</p>
              ) : (
                <ul className="space-y-4">
                  {cartLines.map(({ item, quantity }) => (
                    <li
                      key={item.id}
                      className="flex gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900">{item.name}</p>
                        <p className="text-sm text-zinc-500">
                          {formatInr(item.price)} each
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1 rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-zinc-200">
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100"
                            onClick={() =>
                              setLineQuantity(item.id, quantity - 1)
                            }
                            aria-label={`Decrease ${item.name}`}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100"
                            onClick={() =>
                              setLineQuantity(item.id, quantity + 1)
                            }
                            aria-label={`Increase ${item.name}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-zinc-800">
                          {formatInr(item.price * quantity)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-zinc-100 bg-white px-5 py-4">
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="text-zinc-500">Subtotal</span>
                <span className="text-lg font-bold text-zinc-900">
                  {formatInr(cartTotal)}
                </span>
              </div>
              {orderError && (
                <p className="mb-3 text-center text-sm text-red-600" role="alert">
                  {orderError}
                </p>
              )}
              <button
                type="button"
                disabled={cartLines.length === 0 || orderSubmitting}
                onClick={() => void placeOrder()}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-sm font-semibold text-zinc-900 shadow-md transition hover:from-amber-400 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {orderSubmitting ? "Placing order…" : "Place Order"}
              </button>
              <p className="mt-2 text-center text-xs text-zinc-400">
                Server assigns UUID <code>order_id</code>, 64-char{" "}
                <code>tracking_token</code>, status Received; kitchen gets
                Socket.io <code>new_order</code> (SRS F3, F5).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success — F3 confirmation + tracking token (F4 / S5) */}
      {successInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
            aria-label="Dismiss"
            onClick={dismissSuccess}
          />
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-emerald-200/80 bg-white shadow-2xl"
            role="alertdialog"
            aria-labelledby="success-title"
            aria-describedby="success-desc"
          >
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-emerald-400/30 to-transparent" />
            <div className="relative px-8 pb-8 pt-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 ring-4 ring-emerald-50">
                <CheckCircle2 className="h-9 w-9" strokeWidth={2} />
              </div>
              <h2
                id="success-title"
                className="mt-6 text-2xl font-bold tracking-tight text-zinc-900"
              >
                Order received!
              </h2>
              <p
                id="success-desc"
                className="mt-2 text-sm leading-relaxed text-zinc-600"
              >
                Thank you. Your order is{" "}
                <span className="font-medium text-zinc-800">
                  {ORDER_STATUS_LABELS.received}
                </span>
                . Your order is in the kitchen queue (SRS F5). Save your
                tracking token to follow progress in real time.
              </p>
              <p className="mt-3 font-mono text-xs text-zinc-500">
                Order ID:{" "}
                <span className="font-semibold text-zinc-700">
                  {successInfo.orderId}
                </span>
              </p>
              <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Tracking token
                </p>
                <p
                  className="mt-2 break-all font-mono text-xs font-semibold leading-relaxed tracking-normal text-zinc-900 sm:text-sm"
                  translate="no"
                >
                  {successInfo.token}
                </p>
                <button
                  type="button"
                  onClick={copyToken}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                >
                  <ClipboardCopy className="h-4 w-4" />
                  {copied ? "Copied!" : "Copy token"}
                </button>
              </div>
              <p className="mt-4 text-xs text-zinc-400">
                Data Dictionary: 64-character <code>tracking_token</code> (SRS
                S5) — not guessable from other orders.
              </p>
              <Link
                href={`/track/${successInfo.token}`}
                className="mt-4 block w-full rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-center text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                Open live tracking (U2 · WebSocket + 10s poll fallback)
              </Link>
              <button
                type="button"
                onClick={dismissSuccess}
                className="mt-3 w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Continue browsing
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
