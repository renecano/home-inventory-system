"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Movement = {
  id: number;
  product_id: number;
  type: "consume" | "restock";
  qty: number;
  created_at: string;
  user_id: number | null;
};

type Product = {
  id: number;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
};

export default function HomePage() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentUser, setCurrentUser] = useState<{ id: number; name: string } | null>(
    null
  );

  // toast (sin alerts)
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(
    null
  );
  const toastTimer = useRef<number | null>(null);

  function showToast(msg: string, kind: "ok" | "err" = "ok") {
    setToast({ msg, kind });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  function getUserId(): number | null {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return null;
      const u = JSON.parse(raw);
      return typeof u?.id === "number" ? u.id : null;
    } catch {
      return null;
    }
  }

  function logout() {
    localStorage.removeItem("user");
    router.push("/login");
  }

  async function load(showOkToast = false) {
    setError("");

    const [pRes, mRes] = await Promise.all([
      fetch(`${baseUrl}/products`, { cache: "no-store" }),
      fetch(`${baseUrl}/movements?limit=500`, { cache: "no-store" }),
    ]);

    if (!pRes.ok) throw new Error("No pude cargar productos");
    if (!mRes.ok) throw new Error("No pude cargar movimientos");

    setProducts((await pRes.json()) as Product[]);
    setMovements((await mRes.json()) as Movement[]);

    if (showOkToast) showToast("Actualizado ✅", "ok");
  }

  useEffect(() => {
    const uid = getUserId();
    if (!uid) {
      router.push("/login");
      return;
    }

    try {
      const raw = localStorage.getItem("user");
      if (raw) setCurrentUser(JSON.parse(raw));
    } catch {}

    (async () => {
      try {
        await load(false);
      } catch (e: any) {
        const msg = e?.message || "Error desconocido";
        setError(msg);
        showToast(msg, "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helpers
  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }
  function clampPct(n: number) {
    if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }
  function formatWhen(iso: string) {
    const d = new Date(iso);
    const startToday = startOfToday();
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);

    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (d >= startToday) return `Hoy ${time}`;
    if (d >= startYesterday) return `Ayer ${time}`;
    return d.toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const nameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of products) map.set(p.id, p.name);
    return map;
  }, [products]);

  const lowStock = useMemo(
    () => products.filter((p) => p.current_stock <= p.min_stock).length,
    [products]
  );

  const todayMovements = useMemo(() => {
    const today = startOfToday();
    return movements.filter((m) => new Date(m.created_at) >= today).length;
  }, [movements]);

  const lastMovementLabel = useMemo(() => {
    if (movements.length === 0) return "Sin movimientos";
    const sorted = [...movements].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return formatWhen(sorted[0].created_at);
  }, [movements]);

  const stats = useMemo(() => {
    const totalProducts = products.length;

    const critical = products.filter((p) => p.current_stock === 0).length;
    const ok = products.filter((p) => p.current_stock > p.min_stock).length;

    const lowPct = totalProducts ? (lowStock / totalProducts) * 100 : 0;
    const okPct = totalProducts ? (ok / totalProducts) * 100 : 0;

    const weekStart = daysAgo(7);
    const last7d = movements.filter((m) => new Date(m.created_at) >= weekStart);

    const consumes7d = last7d.filter((m) => m.type === "consume").length;
    const restocks7d = last7d.filter((m) => m.type === "restock").length;

    const freq = new Map<number, number>();
    for (const m of last7d) {
      if (typeof m.product_id !== "number") continue;
      freq.set(m.product_id, (freq.get(m.product_id) || 0) + 1);
    }

    const top = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([productId, count]) => ({
        productId,
        count,
        name: nameById.get(productId) || `Producto #${productId}`,
      }));

    return {
      totalProducts,
      lowStock,
      critical,
      ok,
      lowPct: clampPct(lowPct),
      okPct: clampPct(okPct),
      movements7d: last7d.length,
      consumes7d,
      restocks7d,
      top,
    };
  }, [products, movements, lowStock, nameById]);

  // =========================
  // B) Predicciones (14 días)
  // =========================
  const predictions = useMemo(() => {
    const windowDays = 14;
    const start = new Date();
    start.setDate(start.getDate() - windowDays);

    // consumo total en la ventana por producto
    const consumedByProduct = new Map<number, number>();

    for (const m of movements) {
      if (m.type !== "consume") continue;
      const when = new Date(m.created_at);
      if (when < start) continue;

      consumedByProduct.set(
        m.product_id,
        (consumedByProduct.get(m.product_id) || 0) + m.qty
      );
    }

    const rows = products
      .map((p) => {
        const consumed = consumedByProduct.get(p.id) || 0;
        const perDay = consumed / windowDays; // u/día
        const daysLeft = perDay > 0 ? p.current_stock / perDay : null;

        return {
          id: p.id,
          name: p.name,
          unit: p.unit,
          current_stock: p.current_stock,
          min_stock: p.min_stock,
          perDay,
          daysLeft,
          // prioridad: low stock primero y luego por días restantes
          priority:
            (p.current_stock <= p.min_stock ? -1000 : 0) + (daysLeft ?? 999999),
        };
      })
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 6);

    return rows;
  }, [movements, products]);

  if (loading) return <div className="p-4">Cargando...</div>;

  const statusEmoji = stats.lowStock > 0 ? "⚠️" : "✅";
  const statusText =
    stats.lowStock > 0 ? `Atención: ${stats.lowStock} por acabarse` : "Todo en orden";

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-zinc-50 to-zinc-50">
      {/* Header sticky (hero) */}
      <div className="sticky top-0 z-10 bg-zinc-50/80 backdrop-blur border-b">
        <div className="p-4 max-w-xl mx-auto">
          <div className="rounded-2xl border bg-white shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-500">Panel</div>
                <h1 className="text-2xl font-bold leading-tight">
                  Inventario del hogar 🏠
                </h1>
                {currentUser ? (
                  <p className="mt-1 text-sm text-gray-600">
                    Sesión:{" "}
                    <span className="font-semibold">{currentUser.name}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-gray-600">Sesión activa</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-sm rounded-xl border px-3 py-2 hover:bg-black/5 active:scale-[0.98] transition"
                  onClick={async () => {
                    try {
                      await load(true);
                    } catch (e: any) {
                      const msg = e?.message || "Error desconocido";
                      setError(msg);
                      showToast(msg, "err");
                    }
                  }}
                >
                  Actualizar 🔄
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="text-sm rounded-xl border px-3 py-2 hover:bg-black/5 active:scale-[0.98] transition"
                >
                  Salir
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border bg-zinc-50 px-3 py-1 text-xs text-gray-700">
                Último movimiento:{" "}
                <span className="ml-1 font-semibold">{lastMovementLabel}</span>
              </span>

              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                  stats.lowStock > 0
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-green-200 bg-green-50 text-green-700"
                }`}
              >
                {statusEmoji} {statusText}
              </span>
            </div>
          </div>

          {/* Toast */}
          {toast && (
            <div className="mt-3">
              <div
                className={`rounded-xl border px-3 py-2 text-sm shadow-sm bg-white ${
                  toast.kind === "ok"
                    ? "border-green-200 text-green-800"
                    : "border-red-200 text-red-700"
                }`}
              >
                {toast.msg}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 max-w-xl mx-auto">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* KPIs principales (con color) */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-2xl border bg-white shadow-sm p-4 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-indigo-200" />
            <div className="text-xs text-gray-500">Productos 📦</div>
            <div className="mt-1 text-2xl font-bold">{stats.totalProducts}</div>
            <div className="mt-2 h-1 w-full rounded-full bg-black/5" />
          </div>

          <div className="rounded-2xl border bg-white shadow-sm p-4 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-red-200" />
            <div className="text-xs text-gray-500">Por acabarse 🛒</div>
            <div className={`mt-1 text-2xl font-bold ${stats.lowStock ? "text-red-600" : ""}`}>
              {stats.lowStock}
            </div>
            <div className={`mt-2 h-1 w-full rounded-full ${stats.lowStock ? "bg-red-100" : "bg-black/5"}`} />
          </div>

          <div className="rounded-2xl border bg-white shadow-sm p-4 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-amber-200" />
            <div className="text-xs text-gray-500">Movimientos de Hoy 🔥</div>
            <div className="mt-1 text-2xl font-bold">{todayMovements}</div>
            <div className="mt-2 h-1 w-full rounded-full bg-black/5" />
          </div>
        </div>

        {/* Estadísticas */}
        <div className="rounded-2xl border bg-white shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Estadísticas 📊</div>
              <div className="text-xs text-gray-500">Resumen rápido (últimos 7 días)</div>
            </div>

            <button
              type="button"
              className="text-xs rounded-full border px-3 py-1 hover:bg-black/5"
              onClick={() => router.push("/movements")}
            >
              Ver historial
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs text-gray-500">Sin stock 🚫</div>
              <div className="mt-1 text-xl font-bold">{stats.critical}</div>
              <div className="mt-1 text-xs text-gray-500">Productos con 0 unidades.</div>
            </div>

            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs text-gray-500">En OK ✅</div>
              <div className="mt-1 text-xl font-bold">{stats.ok}</div>
              <div className="mt-1 text-xs text-gray-500">Stock arriba del mínimo.</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>% por acabarse</span>
                <span className="font-medium">{Math.round(stats.lowPct)}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-black/5 overflow-hidden">
                <div className="h-full bg-red-200" style={{ width: `${stats.lowPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>% en OK</span>
                <span className="font-medium">{Math.round(stats.okPct)}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-black/5 overflow-hidden">
                <div className="h-full bg-green-200" style={{ width: `${stats.okPct}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border p-4">
              <div className="text-xs text-gray-500">Movimientos</div>
              <div className="mt-1 text-lg font-bold">{stats.movements7d}</div>
              <div className="mt-1 text-[11px] text-gray-500">últimos 7 días</div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="text-xs text-gray-500">Consumos</div>
              <div className="mt-1 text-lg font-bold text-red-600">{stats.consumes7d}</div>
              <div className="mt-1 text-[11px] text-gray-500">últimos 7 días</div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="text-xs text-gray-500">Reposiciones</div>
              <div className="mt-1 text-lg font-bold text-green-600">{stats.restocks7d}</div>
              <div className="mt-1 text-[11px] text-gray-500">últimos 7 días</div>
            </div>
          </div>

          {stats.top.length > 0 && (
            <div className="mt-5">
              <div className="text-xs font-semibold text-gray-700">
                Top productos con más movimientos (7d) ⭐
              </div>

              <div className="mt-2 space-y-2">
                {stats.top.map((row) => (
                  <div
                    key={row.productId}
                    className="flex items-center justify-between rounded-xl border bg-zinc-50 px-3 py-2"
                  >
                    <div className="text-sm text-gray-700 truncate">{row.name}</div>
                    <div className="text-sm font-semibold">{row.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* C) Predicción 🔮 */}
        <div className="rounded-2xl border bg-white shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Predicción 🔮</div>
              <div className="text-xs text-gray-500">
                Estimación según consumos de los últimos 14 días
              </div>
            </div>

            <button
              type="button"
              className="text-xs rounded-full border px-3 py-1 hover:bg-black/5"
              onClick={() => router.push("/products")}
            >
              Ajustar stock
            </button>
          </div>

          {predictions.length === 0 ? (
            <div className="mt-3 text-sm text-gray-600">
              Sin datos para estimar todavía.
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {predictions.map((r) => {
                const isLow = r.current_stock <= r.min_stock;

                let label = "Sin datos";
                let hint = "Necesito más consumos.";

                if (r.daysLeft !== null) {
                  const d = r.daysLeft;
                  if (d < 1) label = "Se acaba hoy ⚠️";
                  else if (d < 3) label = `~${Math.ceil(d)} días ⚠️`;
                  else if (d < 7) label = `~${Math.ceil(d)} días`;
                  else label = `~${Math.ceil(d)} días ✅`;

                  hint = `~${r.perDay.toFixed(1)} ${r.unit}/día`;
                }

                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                      isLow ? "bg-red-50 border-red-200" : "bg-zinc-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {isLow ? "🛒 " : "📦 "}
                        {r.name}
                      </div>
                      <div className="text-xs text-gray-600">
                        Stock: <span className="font-semibold">{r.current_stock}</span> · Mín{" "}
                        <span className="font-semibold">{r.min_stock}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-3">
                      <div
                        className={`text-sm font-semibold ${
                          isLow ? "text-red-700" : "text-gray-800"
                        }`}
                      >
                        {label}
                      </div>
                      <div className="text-[11px] text-gray-500">{hint}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ✅ Quitamos las tarjetas grandes de navegación */}
        {/* Dejo solo opciones pequeñas al final */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            href="/login"
            className="rounded-2xl border bg-white shadow-sm px-4 py-3 text-sm hover:bg-black/5 text-center transition"
          >
            Cambiar usuario 👤
          </Link>

          <button
            type="button"
            onClick={() => router.push("/products")}
            className="rounded-2xl border bg-white shadow-sm px-4 py-3 text-sm hover:bg-black/5 text-center transition"
          >
            Ir a inventario 📦
          </button>
        </div>
      </div>
    </div>
  );
}
