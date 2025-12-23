"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: number;
  name: string;
  category: string;
  unit: string;
  location: string;
  min_stock: number;
  current_stock: number;
  active: boolean;
};

export default function ShoppingListPage() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const [items, setItems] = useState<Product[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCopy, setBusyCopy] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const router = useRouter();

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

  async function loadLowStock() {
    setError("");
    const res = await fetch(`${baseUrl}/products/low`, { cache: "no-store" });
    if (!res.ok) throw new Error("No pude cargar la lista de súper");
    const data = (await res.json()) as Product[];
    setItems(data);

    // mantener checks existentes si ya estaban
    setChecked((prev) => {
      const next: Record<number, boolean> = {};
      for (const p of data) next[p.id] = prev[p.id] ?? false;
      return next;
    });
  }

  async function loadChecks() {
    const res = await fetch(`${baseUrl}/shopping/checks`, { cache: "no-store" });
    if (!res.ok) throw new Error("No pude cargar checks");
    const data = (await res.json()) as { product_id: number; checked: boolean }[];

    const map: Record<number, boolean> = {};
    for (const row of data) map[row.product_id] = row.checked;
    setChecked(map);
  }

  async function refreshAll(showOkToast = false) {
    try {
      setError("");
      await loadLowStock();
      await loadChecks();
      if (showOkToast) showToast("Lista actualizada", "ok");
    } catch (e: any) {
      const msg = e?.message || "Error desconocido";
      setError(msg);
      showToast(msg, "err");
    }
  }

  useEffect(() => {
    const uid = getUserId();
    if (!uid) {
      router.push("/login");
      return;
    }

    (async () => {
      try {
        await refreshAll(false);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((p) => checked[p.id] === true).length;
    const pending = total - done;
    return { total, done, pending };
  }, [items, checked]);

  const whatsappText = useMemo(() => {
    const lines: string[] = [];
    lines.push("Lista de súper (por acabarse):");

    const sorted = [...items].sort((a, b) => a.category.localeCompare(b.category));

    for (const p of sorted) {
      const isDone = checked[p.id] === true;
      const mark = isDone ? "✅" : "⬜";
      const suggested = Math.max(0, p.min_stock - p.current_stock + 1);

      lines.push(
        `${mark} ${p.name} — ${suggested} ${p.unit} (tengo ${p.current_stock}, mínimo ${p.min_stock}) [${p.category} / ${p.location}]`
      );
    }

    return lines.join("\n");
  }, [items, checked]);

  async function copyToClipboard() {
    if (items.length === 0) return;

    try {
      setBusyCopy(true);
      await navigator.clipboard.writeText(whatsappText);
      showToast("Copiado. Pégalo en WhatsApp.", "ok");
    } catch {
      showToast("No pude copiar. Intenta copiar manualmente.", "err");
    } finally {
      setBusyCopy(false);
    }
  }

  async function toggle(id: number) {
    const next = !(checked[id] === true);

    // optimista (se ve inmediato)
    setChecked((prev) => ({ ...prev, [id]: next }));
    setSavingId(id);

    try {
      const res = await fetch(`${baseUrl}/shopping/checks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked: next }),
      });

      if (!res.ok) throw new Error("No pude guardar el check en la base de datos");

      // mini feedback (sin estorbar)
      showToast(next ? "Marcado como comprado" : "Marcado como pendiente", "ok");
    } catch (e: any) {
      // revertir si falla
      setChecked((prev) => ({ ...prev, [id]: !next }));
      const msg = e?.message || "No pude guardar el check en la base de datos";
      setError(msg);
      showToast(msg, "err");
    } finally {
      setSavingId(null);
    }
  }

  // agrupado por categoría (se ve más ordenado)
  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    const sorted = [...items].sort((a, b) => {
      const c = a.category.localeCompare(b.category);
      if (c !== 0) return c;
      return a.name.localeCompare(b.name);
    });

    for (const p of sorted) {
      const k = p.category || "Sin categoría";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return Array.from(map.entries());
  }, [items]);

  if (loading) return <div className="p-4">Cargando lista...</div>;

  return (
    <div>
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur border-b">
        <div className="p-4 max-w-xl mx-auto flex items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Lista de súper</h1>
            <p className="text-sm text-gray-500">Solo lo que está por acabarse</p>
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
              onClick={() => refreshAll(true)}
            >
              Actualizar
            </button>

            <button
              type="button"
              className="text-sm rounded-lg border px-3 py-2 hover:bg-black/5 disabled:opacity-50"
              onClick={copyToClipboard}
              disabled={items.length === 0 || busyCopy}
              title={items.length === 0 ? "No hay nada por comprar" : "Copiar para WhatsApp"}
            >
              {busyCopy ? "Copiando..." : "Copiar"}
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
      </div>

      {/* Contenido */}
      <div className="p-4 max-w-xl mx-auto">
        {/* Error (sin alerts) */}
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
            Pendiente: <span className="ml-1 font-semibold">{stats.pending}</span>
          </span>
          <span className="inline-flex items-center rounded-full border bg-white px-3 py-1 text-xs text-gray-700">
            Comprado: <span className="ml-1 font-semibold">{stats.done}</span>
          </span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border bg-white p-4 shadow-sm text-sm text-gray-600">
            No hay productos por acabarse. Todo bien.
          </div>
        ) : (
          <>
            <div className="mb-3 rounded-xl border bg-white p-3 text-xs text-gray-600 shadow-sm">
              Tip: marca lo comprado y luego usa “Copiar”.
            </div>

            {/* Agrupado por categoría */}
            <div className="space-y-4">
              {grouped.map(([category, list]) => (
                <div key={category}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold text-gray-700">{category}</div>
                    <div className="text-xs text-gray-500">{list.length} items</div>
                  </div>

                  <ul className="space-y-2">
                    {list.map((p) => {
                      const isDone = checked[p.id] === true;
                      const suggested = Math.max(0, p.min_stock - p.current_stock + 1);
                      const isSaving = savingId === p.id;

                      return (
                        <li
                          key={p.id}
                          className={`rounded-xl border bg-white p-4 shadow-sm transition ${
                            isDone ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => toggle(p.id)}
                              className={`flex items-start gap-3 text-left w-full ${
                                isSaving ? "pointer-events-none" : ""
                              }`}
                              aria-label={isDone ? "Marcar como pendiente" : "Marcar como comprado"}
                            >
                              <div
                                className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center ${
                                  isDone ? "bg-black/5" : "bg-white"
                                }`}
                              >
                                <span className="text-xs">{isDone ? "✓" : ""}</span>
                              </div>

                              <div className="min-w-0">
                                <div className="font-semibold truncate">{p.name}</div>
                                <div className="text-sm text-gray-500 truncate">
                                  {p.location}
                                </div>
                              </div>
                            </button>

                            <div className="shrink-0 text-right">
                              <div className="text-sm font-semibold">
                                Comprar: {suggested} {p.unit}
                              </div>
                              <div className="text-xs text-gray-500">
                                Tengo {p.current_stock} · Mín {p.min_stock}
                              </div>

                              {isSaving && (
                                <div className="mt-2 text-[11px] text-gray-500">
                                  Guardando...
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-medium">
                Ver texto para WhatsApp
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs border rounded-xl p-3 bg-black/5">
                {whatsappText}
              </pre>

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  disabled={items.length === 0 || busyCopy}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
                >
                  {busyCopy ? "Copiando..." : "Copiar"}
                </button>

                <button
                  type="button"
                  onClick={() => showToast("Listo", "ok")}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
                >
                  Cerrar
                </button>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
