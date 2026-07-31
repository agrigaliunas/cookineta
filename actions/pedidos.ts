"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { FRANJAS, FLUJO_ESTADOS, type EstadoPedido } from "@/lib/constantes";
import { diaCorto } from "@/lib/fechas";
import { notificarPedido } from "@/lib/whatsapp";
import type { PayloadCrearPedido, ResultadoCrearPedido } from "@/lib/types";

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
  revalidatePath("/");
  revalidatePath("/admin", "layout");

  return {
    ok: true,
    codigo: r.codigo,
    waUrl,
    total: r.total,
    resumen: `Entrega en ${r.zona} (${r.hub}) el ${dia}, ${franja}.`,
  };
}

/** Mueve el pedido al siguiente estado de la cadena. */
export async function avanzarPedido(pedidoId: string, actual: EstadoPedido) {
  const i = FLUJO_ESTADOS.indexOf(actual);
  if (i === -1 || i === FLUJO_ESTADOS.length - 1) return;

  const siguiente = FLUJO_ESTADOS[i + 1];
  const supabase = await supabaseServer();

  await supabase
    .from("pedidos")
    .update({
      estado: siguiente,
      ...(siguiente === "confirmado" ? { confirmado_en: new Date().toISOString() } : {}),
    })
    .eq("id", pedidoId);

  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

/** Cancelar libera las unidades reservadas: v_disponibilidad ignora los cancelados. */
export async function cancelarPedido(pedidoId: string) {
  const supabase = await supabaseServer();
  await supabase.from("pedidos").update({ estado: "cancelado" }).eq("id", pedidoId);

  revalidatePath("/admin", "layout");
  revalidatePath("/");
}
