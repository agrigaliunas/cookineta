import TablaStock, { type FilaStock } from "@/components/admin/TablaStock";
import { horneadaAbierta } from "@/lib/consultas";
import { supabaseServer } from "@/lib/supabase/server";
import type { Categoria, Disponibilidad, Producto } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stock · La Cookineta" };

export default async function StockPage() {
  const supabase = await supabaseServer();
  const horneada = await horneadaAbierta();

  if (!horneada) {
    return (
      <p style={{ color: "var(--color-neutral-600)" }}>
        No hay ninguna horneada abierta. Creá una desde “Horneada y zonas”.
      </p>
    );
  }

  const [{ data: disponibilidad }, { data: categorias }] = await Promise.all([
    supabase.from("v_disponibilidad").select("*").eq("horneada_id", horneada.id),
    supabase.from("categorias").select("*").eq("activa", true).order("orden"),
  ]);

  const ids = (disponibilidad ?? []).map((d: Disponibilidad) => d.producto_id);
  const { data: productos } = ids.length
    ? await supabase.from("productos").select("*").in("id", ids).order("creado_en")
    : { data: [] as Producto[] };

  const porProducto = new Map(
    (disponibilidad ?? []).map((d: Disponibilidad) => [d.producto_id, d]),
  );

  const filas: FilaStock[] = (productos ?? []).map((p: Producto) => {
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
  });

  return (
    <TablaStock
      horneadaId={horneada.id}
      filas={filas}
      categorias={(categorias ?? []).map((c: Categoria) => ({
        id: c.id,
        nombre: c.nombre,
      }))}
    />
  );
}
