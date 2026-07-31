"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import type { Resultado } from "./stock";

function refrescar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

// ── Categorías ─────────────────────────────────────────────────────────────

export async function crearCategoria(nombre: string): Promise<Resultado> {
  const limpio = nombre.trim();
  if (!limpio) return { ok: false, error: "La categoría necesita un nombre." };

  const supabase = await supabaseServer();

  // Se agrega al final del orden actual.
  const { data: ultima } = await supabase
    .from("categorias")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("categorias")
    .insert({ nombre: limpio, orden: (ultima?.orden ?? 0) + 1 });

  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

export async function renombrarCategoria(
  categoriaId: string,
  nombre: string,
): Promise<Resultado> {
  const limpio = nombre.trim();
  if (!limpio) return { ok: false, error: "La categoría necesita un nombre." };

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("categorias")
    .update({ nombre: limpio })
    .eq("id", categoriaId);

  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

/**
 * Baja la categoría de la vitrina.
 *
 * No la borra: los combos que la usan tienen `on delete restrict`, y los
 * productos quedarían huérfanos. Desactivarla la saca de la vista sin romper
 * nada de lo que ya existe.
 */
export async function desactivarCategoria(
  categoriaId: string,
): Promise<Resultado> {
  const supabase = await supabaseServer();

  const { count } = await supabase
    .from("combo_items")
    .select("*", { count: "exact", head: true })
    .eq("categoria_id", categoriaId);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error:
        "Hay combos que usan esta categoría. Sacala de esos combos antes de desactivarla.",
    };
  }

  const { error } = await supabase
    .from("categorias")
    .update({ activa: false })
    .eq("id", categoriaId);

  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

/** Asigna (o saca, con null) la categoría de un producto. */
export async function fijarCategoriaProducto(
  productoId: string,
  categoriaId: string | null,
): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("productos")
    .update({ categoria_id: categoriaId })
    .eq("id", productoId);

  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

// ── Combos ─────────────────────────────────────────────────────────────────

export type RanuraNueva = { categoriaId: string; cantidad: number };

export async function crearCombo(
  horneadaId: string,
  datos: {
    nombre: string;
    descripcion: string;
    precio: number;
    fotoUrl: string | null;
    ranuras: RanuraNueva[];
  },
): Promise<Resultado> {
  const nombre = datos.nombre.trim();
  if (!nombre) return { ok: false, error: "El combo necesita un nombre." };
  if (!(datos.precio > 0))
    return { ok: false, error: "El precio tiene que ser mayor a cero." };

  const ranuras = datos.ranuras.filter((r) => r.cantidad > 0);
  if (ranuras.length === 0) {
    return {
      ok: false,
      error: "El combo necesita al menos una categoría con cantidad.",
    };
  }

  const supabase = await supabaseServer();

  const { data: combo, error } = await supabase
    .from("combos")
    .insert({
      nombre,
      descripcion: datos.descripcion.trim(),
      precio: Math.round(datos.precio),
      foto_url: datos.fotoUrl,
    })
    .select("id, precio")
    .single();

  if (error || !combo) {
    return { ok: false, error: error?.message ?? "No se pudo crear el combo." };
  }

  const { error: errorRanuras } = await supabase.from("combo_items").insert(
    ranuras.map((r) => ({
      combo_id: combo.id,
      categoria_id: r.categoriaId,
      cantidad: Math.round(r.cantidad),
    })),
  );
  if (errorRanuras) return { ok: false, error: errorRanuras.message };

  // Entra a la vitrina de la horneada actual con su precio congelado.
  const { error: errorHorneada } = await supabase
    .from("horneada_combos")
    .insert({
      horneada_id: horneadaId,
      combo_id: combo.id,
      precio: combo.precio,
    });
  if (errorHorneada) return { ok: false, error: errorHorneada.message };

  refrescar();
  return { ok: true };
}

export async function editarCombo(
  comboId: string,
  datos: {
    nombre: string;
    descripcion: string;
    precio: number;
    fotoUrl: string | null;
    ranuras: RanuraNueva[];
  },
): Promise<Resultado> {
  const nombre = datos.nombre.trim();
  if (!nombre) return { ok: false, error: "El combo necesita un nombre." };

  const ranuras = datos.ranuras.filter((r) => r.cantidad > 0);
  if (ranuras.length === 0) {
    return {
      ok: false,
      error: "El combo necesita al menos una categoría con cantidad.",
    };
  }

  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("combos")
    .update({
      nombre,
      descripcion: datos.descripcion.trim(),
      precio: Math.max(0, Math.round(datos.precio)),
      foto_url: datos.fotoUrl,
    })
    .eq("id", comboId);

  if (error) return { ok: false, error: error.message };

  // Las ranuras se reemplazan enteras: es más simple que diffear, y los pedidos
  // ya hechos guardan su propio snapshot en pedido_combos.
  await supabase.from("combo_items").delete().eq("combo_id", comboId);

  const { error: errorRanuras } = await supabase.from("combo_items").insert(
    ranuras.map((r) => ({
      combo_id: comboId,
      categoria_id: r.categoriaId,
      cantidad: Math.round(r.cantidad),
    })),
  );
  if (errorRanuras) return { ok: false, error: errorRanuras.message };

  refrescar();
  return { ok: true };
}

/** Cambia el precio con el que se cobra el combo en la horneada actual. */
export async function fijarPrecioComboHorneada(
  horneadaId: string,
  comboId: string,
  precio: number,
): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("horneada_combos")
    .update({ precio: Math.max(0, Math.round(precio)) })
    .eq("horneada_id", horneadaId)
    .eq("combo_id", comboId);

  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

/**
 * Saca el combo de la vitrina de esta horneada.
 *
 * Si ya hay pedidos con esa caja no se puede: habría que cancelarlos primero.
 * Y nunca borra el combo — los pedidos históricos lo referencian.
 */
export async function quitarComboDeHorneada(
  horneadaId: string,
  comboId: string,
): Promise<Resultado> {
  const supabase = await supabaseServer();

  const { data: pedidosHorneada } = await supabase
    .from("pedidos")
    .select("id")
    .eq("horneada_id", horneadaId)
    .neq("estado", "cancelado");

  const ids = (pedidosHorneada ?? []).map((p) => p.id);

  if (ids.length > 0) {
    const { count } = await supabase
      .from("pedido_combos")
      .select("*", { count: "exact", head: true })
      .eq("combo_id", comboId)
      .in("pedido_id", ids);

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error:
          "Ya hay pedidos con esta caja en la horneada. Cancelalos antes de sacarla.",
      };
    }
  }

  const { error } = await supabase
    .from("horneada_combos")
    .delete()
    .eq("horneada_id", horneadaId)
    .eq("combo_id", comboId);

  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}
