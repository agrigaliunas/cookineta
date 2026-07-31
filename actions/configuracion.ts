"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { RESERVA_MINUTOS_MAX } from "@/lib/constantes";
import type { Resultado } from "./stock";

/**
 * Cambia cuánto tiempo un pedido sin confirmar retiene el stock.
 *
 * El efecto es inmediato y retroactivo: v_disponibilidad compara contra
 * `now() - reserva_minutos`, así que bajarlo libera de golpe las reservas que
 * ya pasaron ese rato, y subirlo revive las que todavía entren en la ventana
 * nueva. No hay nada que recalcular ni ningún trabajo de fondo que esperar.
 */
export async function fijarReservaMinutos(minutos: number): Promise<Resultado> {
  if (!Number.isFinite(minutos)) {
    return { ok: false, error: "Poné un número de minutos." };
  }

  const valor = Math.round(minutos);

  if (valor < 0 || valor > RESERVA_MINUTOS_MAX) {
    return {
      ok: false,
      error: `Tiene que estar entre 0 minutos y ${RESERVA_MINUTOS_MAX} (una semana).`,
    };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("configuracion")
    .update({ reserva_minutos: valor, actualizada_en: new Date().toISOString() })
    .eq("id", true);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin", "layout");
  revalidatePath("/");
  return { ok: true };
}
