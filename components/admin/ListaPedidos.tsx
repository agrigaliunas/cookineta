"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ETIQUETA_ESTADO,
  FLUJO_ESTADOS,
  TONO_ESTADO,
  pill,
  type EstadoPedido,
  type FormaEntrega,
} from "@/lib/constantes";
import { money } from "@/lib/money";
import { avanzarPedido, cancelarPedido } from "@/actions/pedidos";
import {
  linkWhatsApp,
  mensajeConfirmacion,
  normalizarTelefonoAR,
} from "@/lib/whatsapp";

export type CajaPedido = {
  nombre: string;
  cantidad: number;
  /** 'Chocotón ×4, Red velvet ×2' — lo que hay que poner adentro. */
  contenido: string;
};

/** Estado de la reserva de stock. Sólo la tienen los pedidos sin confirmar. */
export type ReservaPedido = {
  /** Ya pasó el rato: esas unidades volvieron a la vitrina. */
  vencida: boolean;
  texto: string;
};

export type PedidoAdmin = {
  id: string;
  codigo: number;
  cliente: string;
  telefono: string;
  /** Dirección real, o 'Retira en Martínez' si es take away. */
  direccion: string;
  nota: string;
  entrega: FormaEntrega;
  hub: string;
  zonaId: string;
  zonaLabel: string;
  dia: string;
  franja: string;
  /** Cookies sueltas, fuera de las cajas. */
  items: string;
  cajas: CajaPedido[];
  total: number;
  estado: EstadoPedido;
  reserva: ReservaPedido | null;
};

export default function ListaPedidos({
  pedidos,
  zonas,
  filtro,
}: {
  pedidos: PedidoAdmin[];
  zonas: { id: string; label: string }[];
  filtro: string;
}) {
  const visibles =
    filtro === "todos" ? pedidos : pedidos.filter((p) => p.zonaId === filtro);

  const opciones = [{ id: "todos", label: "Todos" }, ...zonas];

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: "var(--color-neutral-600)",
            marginRight: "var(--space-2)",
          }}
        >
          Filtrar
        </span>
        {opciones.map((o) => {
          const p = pill(filtro === o.id, o.id === "sur" ? "dorado" : "azul");
          return (
            <Link
              key={o.id}
              href={o.id === "todos" ? "/admin/pedidos" : `/admin/pedidos?zona=${o.id}`}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                padding: "var(--space-2) var(--space-4)",
                borderRadius: 999,
                textDecoration: "none",
                ...p,
              }}
            >
              {o.label}
            </Link>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        <p style={{ color: "var(--color-neutral-600)" }}>
          Todavía no entró ningún pedido con este filtro.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          {visibles.map((p) => (
            <TarjetaPedido key={p.id} pedido={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaPedido({ pedido }: { pedido: PedidoAdmin }) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const i = FLUJO_ESTADOS.indexOf(pedido.estado);
  const cerrado = pedido.estado === "entregado" || pedido.estado === "cancelado";
  const siguiente = i >= 0 && i < FLUJO_ESTADOS.length - 1 ? FLUJO_ESTADOS[i + 1] : null;
  const [fondo, texto] = TONO_ESTADO[pedido.estado];

  const waCliente = linkWhatsApp(
    normalizarTelefonoAR(pedido.telefono),
    mensajeConfirmacion({
      codigo: pedido.codigo,
      cliente: pedido.cliente.split(" ")[0],
      dia: pedido.dia,
      franja: pedido.franja,
      total: pedido.total,
      entrega: pedido.entrega,
      hub: pedido.hub,
    }),
  );

  return (
    <div className="fila-pedido" style={{ opacity: pendiente ? 0.6 : 1 }}>
      <div style={{ display: "grid", gap: "var(--space-2)", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>
            {pedido.cliente}
          </span>
          <span style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
            #{pedido.codigo}
          </span>
          <span
            className={`tag ${pedido.zonaId === "sur" ? "tag-accent-2" : "tag-accent"}`}
          >
            {pedido.zonaLabel}
          </span>
          {/* Los que retiran no entran al reparto: tiene que saltar a la vista. */}
          {pedido.entrega === "take_away" && (
            <span className="tag tag-neutral">🛍️ Retira</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
          {pedido.direccion} · {pedido.dia} · {pedido.franja}
        </div>
        {pedido.cajas.map((c, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gap: 2,
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-accent-2-100)",
              justifySelf: "start",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {c.cantidad}× {c.nombre}
            </span>
            <span style={{ fontSize: 12, color: "var(--color-accent-2-800)" }}>
              {c.contenido}
            </span>
          </div>
        ))}

        {pedido.items && (
          <div style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
            {pedido.items}
          </div>
        )}
        {pedido.nota && (
          <div
            style={{
              fontSize: 13,
              color: "var(--color-accent-2-800)",
              background: "var(--color-accent-2-100)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--space-1) var(--space-3)",
              justifySelf: "start",
            }}
          >
            Nota: {pedido.nota}
          </div>
        )}
        {pedido.reserva && (
          <div
            style={{
              fontSize: 12,
              color: pedido.reserva.vencida
                ? "var(--color-neutral-600)"
                : "var(--color-accent-700)",
            }}
          >
            {pedido.reserva.vencida ? "⏱ " : ""}
            {pedido.reserva.texto}
          </div>
        )}
        {error && (
          <div
            role="alert"
            style={{
              fontSize: 13,
              color: "var(--color-accent-2-800)",
              background: "var(--color-accent-2-100)",
              border: "1px solid var(--color-accent-2-300)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-2) var(--space-3)",
              justifySelf: "start",
              textWrap: "pretty",
            }}
          >
            {error}
          </div>
        )}
        <a
          href={waCliente}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, justifySelf: "start" }}
        >
          Escribirle por WhatsApp ({pedido.telefono})
        </a>
      </div>

      <div className="fila-pedido-acciones">
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 19 }}>
          {money(pedido.total)}
        </span>
        <span
          style={{
            fontSize: 13,
            padding: "var(--space-1) var(--space-3)",
            borderRadius: 999,
            background: fondo,
            color: texto,
            whiteSpace: "nowrap",
          }}
        >
          {ETIQUETA_ESTADO[pedido.estado]}
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {siguiente && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pendiente}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const r = await avanzarPedido(pedido.id, pedido.estado);
                  if (!r.ok) setError(r.error);
                });
              }}
              style={{
                borderRadius: 999,
                padding: "var(--space-2) var(--space-4)",
                fontSize: 13,
              }}
            >
              Pasar a {ETIQUETA_ESTADO[siguiente]}
            </button>
          )}
          {!cerrado && (
            <button
              type="button"
              className="btn"
              disabled={pendiente}
              onClick={() => {
                if (
                  confirm(
                    `¿Cancelar el pedido #${pedido.codigo} de ${pedido.cliente}? Las unidades vuelven al stock.`,
                  )
                ) {
                  setError(null);
                  startTransition(async () => {
                    const r = await cancelarPedido(pedido.id);
                    if (!r.ok) setError(r.error);
                  });
                }
              }}
              style={{
                borderRadius: 999,
                padding: "var(--space-2) var(--space-4)",
                fontSize: 13,
                color: "var(--color-neutral-600)",
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
