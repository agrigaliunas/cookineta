"use client";

import { useState } from "react";
import type { Catalogo, ComboVitrina } from "@/lib/consultas";
import { cajaCompleta, faltanEnRanura, type Carrito } from "@/lib/carrito";
import { comprometidas } from "@/lib/carrito";
import { money } from "@/lib/money";
import FotoProducto from "@/components/ui/FotoProducto";

/**
 * Diálogo para llenar las ranuras de una caja.
 *
 * El tope de cada `+` es el menor entre lo que falta para completar la ranura y
 * lo que queda de stock descontando lo que ya está en el carrito — el mismo
 * criterio que aplica la RPC, así no se arma un pedido que después rebota.
 */
export default function ArmarCaja({
  combo,
  datos,
  carrito,
  eleccionesIniciales,
  onGuardar,
  onCerrar,
}: {
  combo: ComboVitrina;
  datos: Catalogo;
  carrito: Carrito;
  /** Si viene, se está editando una caja ya armada. */
  eleccionesIniciales?: Record<string, number>;
  onGuardar: (elecciones: Record<string, number>) => void;
  onCerrar: () => void;
}) {
  const [elecciones, setElecciones] = useState<Record<string, number>>(
    eleccionesIniciales ?? {},
  );

  // Al editar, lo que ya tiene esta caja no cuenta como comprometido.
  const yaEnEstaCaja = eleccionesIniciales ?? {};

  const margenDe = (productoId: string) => {
    const p = datos.productos.find((x) => x.id === productoId);
    if (!p) return 0;
    const usadas =
      comprometidas(carrito, productoId) - (yaEnEstaCaja[productoId] ?? 0);
    return Math.max(0, p.disponible - usadas - (elecciones[productoId] ?? 0));
  };

  const completa = cajaCompleta(combo, elecciones, datos.productos);

  function sumar(productoId: string, categoriaId: string) {
    if (faltanEnRanura(combo, elecciones, categoriaId, datos.productos) <= 0) return;
    if (margenDe(productoId) <= 0) return;
    setElecciones((e) => ({ ...e, [productoId]: (e[productoId] ?? 0) + 1 }));
  }

  function restar(productoId: string) {
    setElecciones((e) => {
      if (!e[productoId]) return e;
      const siguiente = { ...e, [productoId]: e[productoId] - 1 };
      if (siguiente[productoId] === 0) delete siguiente[productoId];
      return siguiente;
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Armar ${combo.nombre}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20,
        display: "grid",
        placeItems: "center",
        padding: "var(--space-4)",
        background: "color-mix(in srgb, var(--color-neutral-900) 50%, transparent)",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "min(680px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          display: "grid",
          gap: "var(--space-4)",
          padding: "var(--space-6)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-bg)",
          boxShadow: "var(--shadow-lg)",
          margin: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "var(--space-4)",
          }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <h3 style={{ margin: 0, fontSize: 22 }}>{combo.nombre}</h3>
            <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
              {combo.ranuras
                .map((r) => `${r.cantidad} ${r.categoria.toLowerCase()}`)
                .join(" + ")}{" "}
              · {money(combo.precio)}
            </span>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{
              background: "none",
              border: 0,
              cursor: "pointer",
              fontSize: 24,
              lineHeight: 1,
              color: "var(--color-neutral-600)",
            }}
          >
            ×
          </button>
        </div>

        {combo.ranuras.map((ranura) => {
          const faltan = faltanEnRanura(
            combo,
            elecciones,
            ranura.categoriaId,
            datos.productos,
          );
          const dela = datos.productos.filter(
            (p) => p.categoriaId === ranura.categoriaId,
          );

          return (
            <div
              key={ranura.categoriaId}
              style={{ display: "grid", gap: "var(--space-3)" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "var(--space-3)",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 16 }}>
                  {ranura.categoria}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color:
                      faltan === 0
                        ? "var(--color-accent-2-700)"
                        : "var(--color-neutral-600)",
                  }}
                >
                  {faltan === 0
                    ? `listo · ${ranura.cantidad} de ${ranura.cantidad}`
                    : `elegí ${faltan} más de ${ranura.cantidad}`}
                </span>
              </div>

              {dela.length === 0 && (
                <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
                  Todavía no hay cookies de esta categoría en la horneada.
                </span>
              )}

              <div style={{ display: "grid", gap: "var(--space-2)" }}>
                {dela.map((p) => {
                  const puestas = elecciones[p.id] ?? 0;
                  const sinLugar = faltan <= 0;
                  const sinStock = margenDe(p.id) <= 0;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "var(--space-2) var(--space-3)",
                        borderRadius: "var(--radius-md)",
                        background:
                          puestas > 0 ? "var(--color-accent-100)" : "var(--color-surface)",
                      }}
                    >
                      <FotoProducto
                        url={p.fotoUrl}
                        nombre={p.nombre}
                        alto={40}
                        ancho={52}
                        radio="var(--radius-sm)"
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {p.nombre}
                        </div>
                        <div
                          style={{ fontSize: 12, color: "var(--color-neutral-600)" }}
                        >
                          {p.disponible === 0
                            ? "agotada"
                            : `${p.disponible} disponibles`}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                        }}
                      >
                        <BotonRedondo
                          onClick={() => restar(p.id)}
                          disabled={puestas === 0}
                          etiqueta={`Quitar una ${p.nombre}`}
                        >
                          −
                        </BotonRedondo>
                        <span
                          style={{
                            minWidth: 18,
                            textAlign: "center",
                            fontWeight: 600,
                          }}
                        >
                          {puestas}
                        </span>
                        <BotonRedondo
                          onClick={() => sumar(p.id, ranura.categoriaId)}
                          disabled={sinLugar || sinStock}
                          primario
                          etiqueta={`Sumar una ${p.nombre}`}
                        >
                          +
                        </BotonRedondo>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div
          style={{
            display: "flex",
            gap: "var(--space-3)",
            alignItems: "center",
            flexWrap: "wrap",
            paddingTop: "var(--space-2)",
            borderTop: "1px solid var(--color-divider)",
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            disabled={!completa}
            onClick={() => onGuardar(elecciones)}
            style={{ padding: "var(--space-3) var(--space-6)", fontSize: 15 }}
          >
            {eleccionesIniciales ? "Guardar la caja" : "Agregar al pedido"} ·{" "}
            {money(combo.precio)}
          </button>
          <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
            {completa
              ? "La caja está completa."
              : "Completá todas las categorías para agregarla."}
          </span>
        </div>
      </div>
    </div>
  );
}

function BotonRedondo({
  onClick,
  disabled,
  primario = false,
  etiqueta,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  primario?: boolean;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      style={{
        width: 30,
        height: 30,
        borderRadius: 999,
        border: primario ? 0 : "1px solid var(--color-divider)",
        cursor: disabled ? "not-allowed" : "pointer",
        background: primario ? "var(--color-accent)" : "var(--color-bg)",
        color: primario ? "#fff" : "var(--color-accent-600)",
        fontSize: 16,
        lineHeight: 1,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
