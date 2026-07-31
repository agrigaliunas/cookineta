"use client";

import { money } from "@/lib/money";
import type { PedidoConfirmado } from "./Catalogo";

export default function PedidoOk({
  pedido,
  onNuevoPedido,
}: {
  pedido: PedidoConfirmado;
  onNuevoPedido: () => void;
}) {
  return (
    <div
      style={{
        maxWidth: 620,
        display: "grid",
        gap: "var(--space-6)",
        padding: "var(--space-8)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-surface)",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          background: "var(--color-accent-2-300)",
          display: "grid",
          placeItems: "center",
          fontFamily: "var(--font-heading)",
          fontSize: 26,
          color: "var(--color-accent-2-800)",
        }}
      >
        ✓
      </div>

      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        <h2 style={{ margin: 0, fontSize: 30 }}>
          Pedido #{pedido.codigo} reservado
        </h2>
        <p
          style={{
            margin: 0,
            color: "var(--color-neutral-700)",
            textWrap: "pretty",
          }}
        >
          {pedido.resumen} Total {money(pedido.total)}.
        </p>
      </div>

      {/*
        Al confirmar ya se intentó abrir WhatsApp en otra pestaña, pero iOS y
        los bloqueadores de pop-ups la frenan seguido. Este botón es la salida
        garantizada — sale de un click real, así que ningún bloqueador lo toca.
        Y el pedido ya quedó guardado igual, así que si nunca lo aprieta, a
        La Cookineta le aparece de todas formas como "sin confirmar".
      */}
      <a
        href={pedido.waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary"
        style={{
          justifySelf: "start",
          padding: "var(--space-3) var(--space-8)",
          fontSize: 16,
          textDecoration: "none",
          color: "#fff",
        }}
      >
        Enviar el pedido por WhatsApp
      </a>

      <div
        style={{
          display: "grid",
          gap: "var(--space-2)",
          fontSize: 14,
          color: "var(--color-neutral-700)",
        }}
      >
        <div>
          Si no se abrió solo, tocá el botón: el mensaje ya viene escrito, sólo
          hay que enviarlo.
        </div>
        <div>Te confirmamos por WhatsApp apenas lo veamos.</div>
        <div>El pago es en efectivo o transferencia al recibir.</div>
      </div>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={onNuevoPedido}
        style={{
          borderRadius: 999,
          justifySelf: "start",
          padding: "var(--space-3) var(--space-6)",
        }}
      >
        Hacer otro pedido
      </button>
    </div>
  );
}
