import Header from "@/components/Header";
import FormularioLogin from "./FormularioLogin";

export const metadata = { title: "Entrar · La Cookineta" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volverA?: string }>;
}) {
  const { volverA } = await searchParams;

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header vista="admin" haySesion={false} />
      <div className="pagina" style={{ maxWidth: 460 }}>
        <div style={{ display: "grid", gap: "var(--space-6)" }}>
          <div style={{ display: "grid", gap: "var(--space-1)" }}>
            <h2 style={{ margin: 0, fontSize: 30 }}>Administración</h2>
            <p style={{ margin: 0, color: "var(--color-neutral-600)" }}>
              Entrá para ver los pedidos, el stock y la horneada de la semana.
            </p>
          </div>
          <FormularioLogin volverA={volverA ?? "/admin"} />
        </div>
      </div>
    </div>
  );
}
