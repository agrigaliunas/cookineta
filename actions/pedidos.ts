"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { FRANJAS, FLUJO_ESTADOS, type EstadoPedido } from "@/lib/constantes";
import { diaCorto } from "@/lib/fechas";
import { notificarPedido } from "@/lib/whatsapp";
import type { PayloadCrearPedido, ResultadoCrearPedido } from "@/lib/types";
import type { Resultado } from "./stock";

function refrescar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

export type RespuestaPedido =
  | {
      ok: true;
      codigo: number;
      waUrl: string;
      resumen: string;
      total: number;
    }
  | { ok: false; error: string };

/**
 * Crea el pedido y devuelve el link de WhatsApp ya armado.
 *
 * Toda la validación de verdad (stock, precios, día, franja, horneada abierta)
 * vive en la RPC crear_pedido: corre en una transacción con las filas de stock
 * bloqueadas. Acá sólo se traduce el error a algo que la clienta entienda.
 */
export async function crearPedido(
  payload: PayloadCrearPedido,
): Promise<RespuestaPedido> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("crear_pedido", { payload });

  if (error) {
    return {
      ok: false,
      error:
        error.message?.replace(/^.*?ERROR:\s*/i, "") ||
        "No pudimos registrar el pedido. Probá de nuevo en un momento.",
    };
  }

  const r = data as unknown as ResultadoCrearPedido;
  const franja = FRANJAS[payload.franja_idx] ?? "";
  const dia = diaCorto(r.fecha);

  const { waUrl } = notificarPedido({
    codigo: r.codigo,
    cliente: payload.cliente_nombre,
    telefono: payload.cliente_telefono,
    direccion: payload.direccion,
    // La forma de entrega la confirma la base, no el navegador.
    entrega: r.entrega,
    zona: r.zona,
    hub: r.hub,
    dia,
    franja,
    nota: payload.nota,
    lineas: r.lineas,
    combos: r.combos,
    subtotal: r.subtotal,
    envio: r.envio,
    total: r.total,
  });

  // El stock cambió: la vitrina y el panel tienen que reflejarlo.
  refrescar();

  return {
    ok: true,
    codigo: r.codigo,
    waUrl,
    total: r.total,
    resumen:
      r.entrega === "take_away"
        ? `Lo retirás en ${r.hub} el ${dia}, ${franja}.`
        : `Entrega en ${r.zona} (${r.hub}) el ${dia}, ${franja}.`,
  };
}

/**
 * Mueve el pedido al siguiente estado de la cadena.
 *
 * El salto a 'confirmado' no es un update cualquiera: mientras el pedido estuvo
 * sin confirmar su reserva pudo vencer y otra clienta llevarse esas unidades.
 * Por eso ese paso va por la RPC confirmar_pedido, que revalida el stock con el
 * stock bloqueado. Los demás estados no tocan disponibilidad y van derecho.
 */
export async function avanzarPedido(
  pedidoId: string,
  actual: EstadoPedido,
): Promise<Resultado> {
  const i = FLUJO_ESTADOS.indexOf(actual);
  if (i === -1 || i === FLUJO_ESTADOS.length - 1) return { ok: true };

  const siguiente = FLUJO_ESTADOS[i + 1];
  const supabase = await supabaseServer();

  if (siguiente === "confirmado") {
    const { error } = await supabase.rpc("confirmar_pedido", {
      p_pedido_id: pedidoId,
    });

    if (error) {
      return {
        ok: false,
        error:
          error.message?.replace(/^.*?ERROR:\s*/i, "") ||
          "No pudimos confirmar el pedido. Probá de nuevo.",
      };
    }
  } else {
    const { error } = await supabase
      .from("pedidos")
      .update({ estado: siguiente })
      .eq("id", pedidoId);

    if (error) return { ok: false, error: error.message };
  }

  refrescar();
  return { ok: true };
}

/** Cancelar libera las unidades reservadas: v_disponibilidad ignora los cancelados. */
export async function cancelarPedido(pedidoId: string): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("pedidos")
    .update({ estado: "cancelado" })
    .eq("id", pedidoId);

  if (error) return { ok: false, error: error.message };

  refrescar();
  return { ok: true };
}
