"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { hoyArgentina, sumarDias } from "@/lib/fechas";
import type { Resultado } from "./stock";

function refrescar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

/** Asigna (o libera, con null) la zona que reparte ese día. */
export async function fijarZonaDia(
  diaId: string,
  zonaId: string | null,
): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("horneada_dias")
    .update({ zona_id: zonaId })
    .eq("id", diaId);

  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

/** Prende o apaga una franja horaria del día. */
export async function alternarFranja(
  diaId: string,
  franjaIdx: number,
): Promise<Resultado> {
  const supabase = await supabaseServer();

  const { data: dia } = await supabase
    .from("horneada_dias")
    .select("franjas")
    .eq("id", diaId)
    .single();

  if (!dia) return { ok: false, error: "Ese día ya no existe." };

  const actuales = dia.franjas ?? [];
  const franjas = actuales.includes(franjaIdx)
    ? actuales.filter((f: number) => f !== franjaIdx)
    : [...actuales, franjaIdx].sort((a, b) => a - b);

  const { error } = await supabase
    .from("horneada_dias")
    .update({ franjas })
    .eq("id", diaId);

  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

export async function fijarEnvioZona(
  zonaId: string,
  envio: number,
): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("zonas")
    .update({ envio: Math.max(0, Math.round(envio)) })
    .eq("id", zonaId);

  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

export async function fijarEnvioGratis(
  horneadaId: string,
  desde: number,
): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("horneadas")
    .update({ envio_gratis_desde: Math.max(0, Math.round(desde)) })
    .eq("id", horneadaId);

  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

/**
 * Cierra la horneada en curso y abre la de la semana siguiente.
 *
 * Copia el plan de stock y el mapa de zonas/franjas de la anterior, así arrancar
 * la semana es un clic y después se ajusta. Los pedidos viejos quedan colgando
 * de la horneada cerrada; el cliente ya no la ve.
 */
export async function abrirSiguienteHorneada(): Promise<
  Resultado & { numero?: number }
> {
  const supabase = await supabaseServer();

  const { data: actual } = await supabase
    .from("horneadas")
    .select("*")
    .eq("estado", "abierta")
    .maybeSingle();

  // El molde sale de la última horneada por número, esté abierta o cerrada: si
  // se cerró una semana sin abrir la siguiente, igual se hereda la grilla.
  const { data: molde } = await supabase
    .from("horneadas")
    .select("*")
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();

  const numero = (molde?.numero ?? 0) + 1;
  const inicio = molde?.fecha_fin
    ? sumarDias(molde.fecha_fin, 1)
    : hoyArgentina();
  const fin = sumarDias(inicio, 6);

  // Primero cerrar: el índice único deja una sola horneada abierta a la vez.
  if (actual) {
    const { error } = await supabase
      .from("horneadas")
      .update({ estado: "cerrada" })
      .eq("id", actual.id);
    if (error) return { ok: false, error: error.message };
  }

  const { data: nueva, error: errorNueva } = await supabase
    .from("horneadas")
    .insert({
      numero,
      fecha_inicio: inicio,
      fecha_fin: fin,
      estado: "abierta",
      envio_gratis_desde: molde?.envio_gratis_desde ?? 20000,
    })
    .select("id")
    .single();

  if (errorNueva || !nueva) {
    return {
      ok: false,
      error: errorNueva?.message ?? "No se pudo crear la horneada.",
    };
  }

  // Los 7 días, heredando zona y franjas del mismo día de la semana anterior.
  const { data: diasPrevios } = molde
    ? await supabase
        .from("horneada_dias")
        .select("fecha, zona_id, franjas")
        .eq("horneada_id", molde.id)
        .order("fecha")
    : { data: [] };

  const dias = Array.from({ length: 7 }, (_, i) => {
    const previo = (diasPrevios ?? [])[i];
    return {
      horneada_id: nueva.id,
      fecha: sumarDias(inicio, i),
      zona_id: previo?.zona_id ?? null,
      franjas: previo?.franjas ?? [],
    };
  });

  const { error: errorDias } = await supabase.from("horneada_dias").insert(dias);
  if (errorDias) return { ok: false, error: errorDias.message };

  // El plan de stock arranca en el mismo planificado, con el precio ACTUAL del
  // producto: acá sí corresponde tomar los aumentos de la ficha.
  if (molde) {
    const { data: stockPrevio } = await supabase
      .from("horneada_stock")
      .select("producto_id, planificado")
      .eq("horneada_id", molde.id);

    const ids = (stockPrevio ?? []).map((s) => s.producto_id);
    if (ids.length) {
      const { data: productos } = await supabase
        .from("productos")
        .select("id, precio")
        .in("id", ids)
        .eq("activo", true);

      const precios = new Map((productos ?? []).map((p) => [p.id, p.precio]));

      const nuevoStock = (stockPrevio ?? [])
        .filter((s) => precios.has(s.producto_id))
        .map((s) => ({
          horneada_id: nueva.id,
          producto_id: s.producto_id,
          planificado: s.planificado,
          precio: precios.get(s.producto_id)!,
        }));

      if (nuevoStock.length) {
        const { error } = await supabase
          .from("horneada_stock")
          .insert(nuevoStock);
        if (error) return { ok: false, error: error.message };
      }
    }
  }

  refrescar();
  return { ok: true, numero };
}
