"use client";

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
};

type User = { id: number; name: string };

function getUserId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: number };
    return typeof parsed?.id === "number" ? parsed.id : null;
  } catch {
    return null;
  }
}

type RangeFilter = "today" | "7d" | "all";
type TypeFilter = "all" | "consume" | "restock";

export default function MovementsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const router = useRouter();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // filtros
  const [range, setRange] = useState<RangeFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [q, setQ] = useState(""); // búsqueda

  // toast debajo del header (sin alerts)
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(
    null
  );
  const toastTimer = useRef<number | null>(null);

  function showToast(msg: string, kind: "ok" | "err" = "ok") {
    setToast({ msg, kind });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  async function load(showOkToast = false) {
    setError("");

    const [mRes, pRes, uRes] = await Promise.all([
      fetch(`${baseUrl}/movements?limit=50`, { cache: "no-store" }),
      fetch(`${baseUrl}/products`, { cache: "no-store" }),
      fetch(`${baseUrl}/users`, { cache: "no-store" }),
    ]);

    if (!mRes.ok) throw new Error("No pude traer movimientos");
    if (!pRes.ok) throw new Error("No pude traer productos");
    if (!uRes.ok) throw new Error("No pude traer usuarios");

    setMovements((await mRes.json()) as Movement[]);
    setProducts((await pRes.json()) as Product[]);
    setUsers((await uRes.json()) as User[]);

    if (showOkToast) showToast("Historial actualizado", "ok");
  }

  useEffect(() => {
    const uid = getUserId();
    if (!uid) {
      router.push("/login");
      return;
    }

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
  }, [router]);

  const nameById = useMemo(
    () => new Map(products.map((p) => [p.id, p.name] as const)),
    [products]
  );
  const userNameById = useMemo(
    () => new Map(users.map((u) => [u.id, u.name] as const)),
    [users]
  );

  function formatWhen(iso: string) {
    // “hoy 13:10”, “ayer 08:22”, o fecha corta
    const d = new Date(iso);
    const now = new Date();

    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);

    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);

    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (d >= startToday) return `Hoy ${time}`;
    if (d >= startYesterday) return `Ayer ${time}`;

    return d.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const visible = useMemo(() => {
    let list = movements;

    // rango
    if (range !== "all") {
      const now = new Date();
      const start = new Date(now);

      if (range === "today") {
        start.setHours(0, 0, 0, 0);
      } else if (range === "7d") {
        start.setDate(start.getDate() - 7);
      }

      list = list.filter((m) => new Date(m.created_at) >= start);
    }

    // tipo
    if (type !== "all") {
      list = list.filter((m) => m.type === type);
    }

    // búsqueda (producto o usuario)
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((m) => {
        const productName = (nameById.get(m.product_id) || "").toLowerCase();
        const userName = m.user_id ? (userNameById.get(m.user_id) || "").toLowerCase() : "";
        const kind = m.type === "consume" ? "consumo" : "reposición";
        const hay = `${productName} ${userName} ${kind}`.toLowerCase();
        return hay.includes(query);
      });
    }

    // ordenar más reciente primero (por si acaso el backend no lo hace)
    return [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [movements, range, type, q, nameById, userNameById]);

  const stats = useMemo(() => {
    const total = visible.length;
    const consumes = visible.filter((m) => m.type === "consume").length;
    const restocks = visible.filter((m) => m.type === "restock").length;
    return { total, consumes, restocks };
  }, [visible]);

  if (loading) return <div className="p-4">Cargando movimientos...</div>;

  return (
    <div>
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur border-b">
        <div className="p-4 max-w-xl mx-auto flex items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Movimientos</h1>
            <p className="text-sm text-gray-500">Historial de consumos y reposiciones</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="text-sm rounded-lg border px-3 py-2 hover:bg-black/5"
              onClick={() => router.push("/")}
            >
              Home
            </button>

            <button
              type="button"
              className="text-sm rounded-lg border px-3 py-2 hover:bg-black/5"
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
              Actualizar
            </button>
          </div>
        </div>

        {/* Toast debajo del header */}
        {toast && (
          <div className="px-4 pb-3 max-w-xl mx-auto">
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

        {/* Filtros + búsqueda */}
        <div className="px-4 pb-4 max-w-xl mx-auto space-y-2">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
            placeholder="Buscar por producto o usuario…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            {/* rango */}
            <div className="flex rounded-lg border p-1 bg-white">
              <button
                type="button"
                onClick={() => setRange("today")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                  range === "today" ? "bg-black/5" : "hover:bg-black/5"
                }`}
              >
                Hoy
              </button>

              <button
                type="button"
                onClick={() => setRange("7d")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                  range === "7d" ? "bg-black/5" : "hover:bg-black/5"
                }`}
              >
                7 días
              </button>

              <button
                type="button"
                onClick={() => setRange("all")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                  range === "all" ? "bg-black/5" : "hover:bg-black/5"
                }`}
              >
                Todos
              </button>
            </div>

            {/* tipo */}
            <div className="flex rounded-lg border p-1 bg-white">
              <button
                type="button"
                onClick={() => setType("all")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                  type === "all" ? "bg-black/5" : "hover:bg-black/5"
                }`}
              >
                Todo
              </button>

              <button
                type="button"
                onClick={() => setType("consume")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                  type === "consume" ? "bg-black/5" : "hover:bg-black/5"
                }`}
              >
                Consumos
              </button>

              <button
                type="button"
                onClick={() => setType("restock")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                  type === "restock" ? "bg-black/5" : "hover:bg-black/5"
                }`}
              >
                Repos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 max-w-xl mx-auto">
        {/* Error (sin pantalla roja completa) */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Summary chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border bg-white px-3 py-1 text-xs text-gray-700">
            Total: <span className="ml-1 font-semibold">{stats.total}</span>
          </span>
          <span className="inline-flex items-center rounded-full border bg-white px-3 py-1 text-xs text-gray-700">
            Consumos: <span className="ml-1 font-semibold">{stats.consumes}</span>
          </span>
          <span className="inline-flex items-center rounded-full border bg-white px-3 py-1 text-xs text-gray-700">
            Reposiciones: <span className="ml-1 font-semibold">{stats.restocks}</span>
          </span>

          {(range !== "all" || type !== "all" || q.trim()) && (
            <button
              type="button"
              onClick={() => {
                setRange("all");
                setType("all");
                setQ("");
                showToast("Filtros limpiados", "ok");
              }}
              className="inline-flex items-center rounded-full border bg-white px-3 py-1 text-xs text-gray-700 hover:bg-black/5"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border bg-white p-4 shadow-sm text-sm text-gray-600">
            No hay movimientos para{" "}
            {range === "today" ? "hoy" : range === "7d" ? "los últimos 7 días" : "mostrar"}.
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((m) => {
              const productName = nameById.get(m.product_id) || `Producto #${m.product_id}`;
              const who = m.user_id
                ? userNameById.get(m.user_id) || `Usuario #${m.user_id}`
                : "(sin usuario)";

              const isConsume = m.type === "consume";

              return (
                <li
                  key={m.id}
                  className="rounded-xl border bg-white p-4 shadow-sm flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${
                          isConsume
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-green-200 bg-green-50 text-green-700"
                        }`}
                      >
                        {isConsume ? "Consumo" : "Reposición"}
                      </span>

                      <span className="text-sm font-semibold truncate">{productName}</span>
                    </div>

                    <div className="mt-1 text-sm text-gray-700">
                      Cantidad: <span className="font-semibold">{m.qty}</span>
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      Por: <span className="font-medium text-gray-700">{who}</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-xs text-gray-500 whitespace-nowrap">
                      {formatWhen(m.created_at)}
                    </div>
                    <div className="mt-2 text-[11px] text-gray-400">
                      ID #{m.id}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
