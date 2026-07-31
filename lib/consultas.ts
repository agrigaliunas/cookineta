import { supabaseServer } from "@/lib/supabase/server";
import { diaCorto, diaLargo, nombreDia, rangoHorneada } from "@/lib/fechas";
import type {
  Categoria,
  Combo,
  ComboItem,
  Disponibilidad,
  Horneada,
  HorneadaCombo,
  HorneadaDia,
  Producto,
  Zona,
} from "@/lib/types";

export type DiaEntrega = {
  id: string;
  fecha: string;
  /** 'Lunes 3/8' */
  etiqueta: string;
  /** 'Lunes' */
  nombreDia: string;
  /** '3 de agosto' */
  fechaLarga: string;
  zonaId: string | null;
  franjas: number[];
};

export type ProductoVitrina = {
  id: string;
  nombre: string;
  descripcion: string;
  fotoUrl: string | null;
  categoriaId: string | null;
  /** Precio congelado de la horneada, no el de la ficha del producto. */
  precio: number;
  planificado: number;
  reservado: number;
  disponible: number;
};

/** Una ranura del combo, ya resuelta con el nombre de la categoría. */
export type RanuraCombo = {
  categoriaId: string;
  categoria: string;
  cantidad: number;
};

export type ComboVitrina = {
  id: string;
  nombre: string;
  descripcion: string;
  fotoUrl: string | null;
  /** Precio fijo congelado de la horneada. */
  precio: number;
  ranuras: RanuraCombo[];
  /** Total de cookies que entran en la caja. */
  unidades: number;
};

export type Catalogo = {
  horneada: Horneada;
  label: string;
  rango: string;
  zonas: Zona[];
  dias: DiaEntrega[];
  categorias: Categoria[];
  productos: ProductoVitrina[];
  combos: ComboVitrina[];
};

/** La horneada que el cliente puede comprar. Null si no hay ninguna abierta. */
export async function horneadaAbierta(): Promise<Horneada | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("horneadas")
    .select("*")
    .eq("estado", "abierta")
    .maybeSingle();
  return data ?? null;
}

/** Arma el día tal como lo consume la UI, con las fechas ya formateadas. */
export function armarDia(d: HorneadaDia): DiaEntrega {
  return {
    id: d.id,
    fecha: d.fecha,
    etiqueta: diaCorto(d.fecha),
    nombreDia: nombreDia(d.fecha),
    fechaLarga: diaLargo(d.fecha),
    zonaId: d.zona_id,
    franjas: [...d.franjas].sort((a, b) => a - b),
  };
}

/**
 * Todo lo que necesita la vitrina en una sola pasada.
 *
 * El formateo de fechas se hace acá, en el servidor: si el navegador parsea
 * '2026-08-03' lo interpreta en UTC y en Argentina muestra el 2.
 */
export async function cargarCatalogo(): Promise<Catalogo | null> {
  const supabase = await supabaseServer();

  const horneada = await horneadaAbierta();
  if (!horneada) return null;

  const [
    { data: zonas },
    { data: dias },
    { data: disponibilidad },
    { data: categorias },
    { data: horneadaCombos },
  ] = await Promise.all([
    supabase.from("zonas").select("*").eq("activa", true).order("orden"),
    supabase
      .from("horneada_dias")
      .select("*")
      .eq("horneada_id", horneada.id)
      .order("fecha"),
    supabase.from("v_disponibilidad").select("*").eq("horneada_id", horneada.id),
    supabase.from("categorias").select("*").eq("activa", true).order("orden"),
    supabase.from("horneada_combos").select("*").eq("horneada_id", horneada.id),
  ]);

  const idsProducto = (disponibilidad ?? []).map(
    (d: Disponibilidad) => d.producto_id,
  );
  const idsCombo = (horneadaCombos ?? []).map((c: HorneadaCombo) => c.combo_id);

  const [{ data: productos }, { data: combos }, { data: ranuras }] =
    await Promise.all([
      idsProducto.length
        ? supabase
            .from("productos")
            .select("*")
            .in("id", idsProducto)
            .eq("activo", true)
            .order("creado_en")
        : Promise.resolve({ data: [] as Producto[] }),
      idsCombo.length
        ? supabase
            .from("combos")
            .select("*")
            .in("id", idsCombo)
            .eq("activo", true)
            .order("creado_en")
        : Promise.resolve({ data: [] as Combo[] }),
      idsCombo.length
        ? supabase.from("combo_items").select("*").in("combo_id", idsCombo)
        : Promise.resolve({ data: [] as ComboItem[] }),
    ]);

  const porProducto = new Map(
    (disponibilidad ?? []).map((d: Disponibilidad) => [d.producto_id, d]),
  );
  const precioCombo = new Map(
    (horneadaCombos ?? []).map((c: HorneadaCombo) => [c.combo_id, c.precio]),
  );
  const nombreCategoria = new Map(
    (categorias ?? []).map((c: Categoria) => [c.id, c.nombre]),
  );

  return {
    horneada,
    label: `Horneada ${horneada.numero}`,
    rango: rangoHorneada(horneada.fecha_inicio, horneada.fecha_fin),
    zonas: zonas ?? [],
    dias: (dias ?? []).map(armarDia),
    categorias: categorias ?? [],
    productos: (productos ?? []).map((p: Producto): ProductoVitrina => {
      const d = porProducto.get(p.id)!;
      return {
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        fotoUrl: p.foto_url,
        categoriaId: p.categoria_id,
        precio: d.precio,
        planificado: d.planificado,
        reservado: d.reservado,
        disponible: d.disponible,
      };
    }),
    combos: (combos ?? [])
      .map((c: Combo): ComboVitrina => {
        const propias = (ranuras ?? [])
          .filter((r: ComboItem) => r.combo_id === c.id)
          .map((r: ComboItem) => ({
            categoriaId: r.categoria_id,
            categoria: nombreCategoria.get(r.categoria_id) ?? "Categoría",
            cantidad: r.cantidad,
          }));
        return {
          id: c.id,
          nombre: c.nombre,
          descripcion: c.descripcion,
          fotoUrl: c.foto_url,
          precio: precioCombo.get(c.id) ?? c.precio,
          ranuras: propias,
          unidades: propias.reduce((n, r) => n + r.cantidad, 0),
        };
      })
      // Un combo sin ranuras no se puede armar: no tiene sentido mostrarlo.
      .filter((c: ComboVitrina) => c.ranuras.length > 0),
  };
}
