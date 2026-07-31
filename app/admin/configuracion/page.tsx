import Configuracion from "@/components/admin/Configuracion";
import { horneadaAbierta, reservaMinutos } from "@/lib/consultas";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración · La Cookineta" };

export default async function ConfiguracionPage() {
  const supabase = await supabaseServer();
  const [minutos, horneada] = await Promise.all([
    reservaMinutos(),
    horneadaAbierta(),
  ]);

  const { count } = horneada
    ? await supabase
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .eq("horneada_id", horneada.id)
        .eq("estado", "pendiente_whatsapp")
    : { count: 0 };

  return <Configuracion reservaMinutos={minutos} pendientes={count ?? 0} />;
}
