import GestionCombos, {
  type ComboAdmin,
} from "@/components/admin/GestionCombos";
import { horneadaAbierta } from "@/lib/consultas";
import { supabaseServer } from "@/lib/supabase/server";
import type { Categoria, Combo, ComboItem, HorneadaCombo } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categorías y combos · La Cookineta" };

export default async function CombosPage() {
  const supabase = await supabaseServer();
  const horneada = await horneadaAbierta();

  const [{ data: categorias }, { data: combos }, { data: ranuras }] =
    await Promise.all([
      supabase.from("categorias").select("*").eq("activa", true).order("orden"),
      supabase.from("combos").select("*").eq("activo", true).order("creado_en"),
      supabase.from("combo_items").select("*"),
    ]);

  const { data: enHorneada } = horneada
    ? await supabase
        .from("horneada_combos")
        .select("*")
        .eq("horneada_id", horneada.id)
    : { data: [] as HorneadaCombo[] };

  const precioEnHorneada = new Map(
    (enHorneada ?? []).map((h: HorneadaCombo) => [h.combo_id, h.precio]),
  );

  // Cuántos productos activos tiene cada categoría: una categoría vacía no se
  // puede usar en un combo, y conviene avisarlo antes de que falle un pedido.
  const { data: productos } = await supabase
    .from("productos")
    .select("id, categoria_id")
    .eq("activo", true);

  const conteo = new Map<string, number>();
  for (const p of productos ?? []) {
    if (p.categoria_id) {
      conteo.set(p.categoria_id, (conteo.get(p.categoria_id) ?? 0) + 1);
    }
  }

  const filas: ComboAdmin[] = (combos ?? []).map((c: Combo) => ({
    id: c.id,
    nombre: c.nombre,
    descripcion: c.descripcion,
    fotoUrl: c.foto_url,
    precio: c.precio,
    precioHorneada: precioEnHorneada.get(c.id) ?? null,
    ranuras: (ranuras ?? [])
      .filter((r: ComboItem) => r.combo_id === c.id)
      .map((r: ComboItem) => ({
        categoriaId: r.categoria_id,
        cantidad: r.cantidad,
      })),
  }));

  return (
    <GestionCombos
      horneadaId={horneada?.id ?? null}
      categorias={(categorias ?? []).map((c: Categoria) => ({
        id: c.id,
        nombre: c.nombre,
        productos: conteo.get(c.id) ?? 0,
      }))}
      combos={filas}
    />
  );
}
