"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export type Resultado = { ok: true } | { ok: false; error: string };

function refrescar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

/**
 * Fija las unidades planificadas de un producto en la horneada.
 *
 * Nunca por debajo de lo ya reservado: si hay 14 vendidas, planificar 12
 * dejaría a dos clientas sin su pedido.
 */
export async function fijarPlanificado(
  horneadaId: string,
  productoId: string,
  planificado: number,
): Promise<Resultado> {
  const supabase = await supabaseServer();

  const { data: disp } = await supabase
    .from("v_disponibilidad")
    .select("reservado")
    .eq("horneada_id", horneadaId)
    .eq("producto_id", productoId)
    .maybeSingle();

  const minimo = disp?.reservado ?? 0;
  const valor = Math.max(minimo, Math.max(0, Math.round(planificado)));

  const { error } = await supabase
    .from("horneada_stock")
    .update({ planificado: valor })
    .eq("horneada_id", horneadaId)
    .eq("producto_id", productoId);

  if (error) return { ok: false, error: error.message };

  refrescar();
  return { ok: true };
}

/** Alta de producto: crea la ficha y lo suma a la vitrina de la horneada. */
export async function crearProducto(
  horneadaId: string,
  datos: {
    nombre: string;
    descripcion: string;
    precio: number;
    planificado: number;
    fotoUrl: string | null;
    categoriaId: string | null;
  },
): Promise<Resultado> {
  const nombre = datos.nombre.trim();
  if (!nombre) return { ok: false, error: "El producto necesita un nombre." };
  if (!(datos.precio > 0))
    return { ok: false, error: "El precio tiene que ser mayor a cero." };

  const supabase = await supabaseServer();

  const { data: producto, error } = await supabase
    .from("productos")
    .insert({
      nombre,
      descripcion: datos.descripcion.trim() || "Novedad de la horneada.",
      precio: Math.round(datos.precio),
      foto_url: datos.fotoUrl,
      categoria_id: datos.categoriaId,
    })
    .select("id, precio")
    .single();

  if (error || !producto) {
    return { ok: false, error: error?.message ?? "No se pudo crear el producto." };
  }

  const { error: errorStock } = await supabase.from("horneada_stock").insert({
    horneada_id: horneadaId,
    producto_id: producto.id,
    planificado: Math.max(0, Math.round(datos.planificado)),
    precio: producto.precio,
  });

  if (errorStock) return { ok: false, error: errorStock.message };

  refrescar();
  return { ok: true };
}

/**
 * Edita la ficha del producto.
 *
 * El precio nuevo NO toca la horneada en curso: horneada_stock.precio quedó
 * congelado al abrirla, así que quien ya vio $2200 sigue pagando $2200.
 */
export async function editarProducto(
  productoId: string,
  datos: {
    nombre: string;
    descripcion: string;
    precio: number;
    fotoUrl: string | null;
    categoriaId: string | null;
  },
): Promise<Resultado> {
  const nombre = datos.nombre.trim();
  if (!nombre) return { ok: false, error: "El producto necesita un nombre." };

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("productos")
    .update({
      nombre,
      descripcion: datos.descripcion.trim(),
      precio: Math.max(0, Math.round(datos.precio)),
      foto_url: datos.fotoUrl,
      categoria_id: datos.categoriaId,
    })
    .eq("id", productoId);

  if (error) return { ok: false, error: error.message };

  refrescar();
  return { ok: true };
}

/** Cambia el precio con el que se cobra este producto en la horneada actual. */
export async function fijarPrecioHorneada(
  horneadaId: string,
  productoId: string,
  precio: number,
): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("horneada_stock")
    .update({ precio: Math.max(0, Math.round(precio)) })
    .eq("horneada_id", horneadaId)
    .eq("producto_id", productoId);

  if (error) return { ok: false, error: error.message };

  refrescar();
  return { ok: true };
}

/**
 * Saca el producto de la vitrina de esta horneada.
 *
 * Si ya tiene unidades reservadas no se puede: habría que cancelar esos pedidos
 * primero. Y nunca borra la ficha del producto — los pedidos históricos la
 * referencian.
 */
export async function quitarDeHorneada(
  horneadaId: string,
  productoId: string,
): Promise<Resultado> {
  const supabase = await supabaseServer();

  const { data: disp } = await supabase
    .from("v_disponibilidad")
    .select("reservado")
    .eq("horneada_id", horneadaId)
    .eq("producto_id", productoId)
    .maybeSingle();

  if ((disp?.reservado ?? 0) > 0) {
    return {
      ok: false,
      error:
        "Ya hay pedidos con este producto en la horneada. Cancelalos antes de sacarlo.",
    };
  }

  const { error } = await supabase
    .from("horneada_stock")
    .delete()
    .eq("horneada_id", horneadaId)
    .eq("producto_id", productoId);

  if (error) return { ok: false, error: error.message };

  refrescar();
  return { ok: true };
}
