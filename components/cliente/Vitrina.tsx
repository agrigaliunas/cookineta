"use client";

import type { Catalogo, ComboVitrina, ProductoVitrina } from "@/lib/consultas";
import { comprometidas, type Carrito } from "@/lib/carrito";
import { money } from "@/lib/money";
import FotoProducto from "@/components/ui/FotoProducto";

export default function Vitrina({
  datos,
  carrito,
  onSumar,
  onRestar,
  onArmarCaja,
}: {
  datos: Catalogo;
  carrito: Carrito;
  onSumar: (id: string) => void;
  onRestar: (id: string) => void;
  onArmarCaja: (combo: ComboVitrina) => void;
}) {
  const totalDisponible = datos.productos.reduce((n, p) => n + p.disponible, 0);

  // Una sección por categoría, respetando el orden que definió el admin, y una
  // última con lo que quedó sin categoría para que nunca desaparezca del sitio.
  const secciones = [
    ...datos.categorias.map((c) => ({
      id: c.id,
      titulo: c.nombre,
      productos: datos.productos.filter((p) => p.categoriaId === c.id),
    })),
    {
      id: "sin-categoria",
      titulo: "Otras cookies",
      productos: datos.productos.filter(
        (p) =>
          p.categoriaId === null ||
          !datos.categorias.some((c) => c.id === p.categoriaId),
      ),
    },
  ].filter((s) => s.productos.length > 0);

  return (
    <div style={{ display: "grid", gap: "var(--space-8)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 22 }}>La vitrina</h3>
        <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
          {datos.label} · {totalDisponible} unidades disponibles
        </span>
      </div>

      {datos.combos.length > 0 && (
        <section style={{ display: "grid", gap: "var(--space-4)" }}>
          <TituloSeccion texto="Combos para compartir" destacado />
          <div className="grid-vitrina">
            {datos.combos.map((c) => (
              <TarjetaCombo
                key={c.id}
                combo={c}
                enCarrito={carrito.cajas.filter((x) => x.comboId === c.id).length}
                onArmar={() => onArmarCaja(c)}
              />
            ))}
          </div>
        </section>
      )}

      {secciones.map((s) => (
        <section key={s.id} style={{ display: "grid", gap: "var(--space-4)" }}>
          <TituloSeccion texto={s.titulo} />
          <div className="grid-vitrina">
            {s.productos.map((p) => (
              <TarjetaProducto
                key={p.id}
                producto={p}
                enCarrito={carrito.sueltas[p.id] ?? 0}
                comprometidas={comprometidas(carrito, p.id)}
                onSumar={() => onSumar(p.id)}
                onRestar={() => onRestar(p.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TituloSeccion({
  texto,
  destacado = false,
}: {
  texto: string;
  destacado?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
      }}
    >
      <h4
        style={{
          margin: 0,
          fontSize: 18,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: destacado
            ? "var(--color-accent-2-800)"
            : "var(--color-accent-700)",
        }}
      >
        {texto}
      </h4>
      <span
        style={{
          flex: 1,
          height: 2,
          borderRadius: 999,
          background: destacado
            ? "var(--color-accent-2-300)"
            : "var(--color-divider)",
        }}
      />
    </div>
  );
}

function TarjetaCombo({
  combo,
  enCarrito,
  onArmar,
}: {
  combo: ComboVitrina;
  enCarrito: number;
  onArmar: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--space-3)",
        padding: "var(--space-6)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-accent-2-100)",
        border: "1px solid var(--color-accent-2-300)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <FotoProducto
        url={combo.fotoUrl}
        nombre={combo.nombre}
        alto={168}
        radio="var(--radius-md)"
      />

      <div style={{ display: "grid", gap: 4 }}>
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 17,
            lineHeight: 1.15,
          }}
        >
          {combo.nombre}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--color-neutral-700)",
            textWrap: "pretty",
          }}
        >
          {combo.descripcion}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          {combo.ranuras.map((r) => (
            <span key={r.categoriaId} className="tag tag-accent-2">
              {r.cantidad} {r.categoria}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 2 }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 18 }}>
            {money(combo.precio)}
          </span>
          <span style={{ fontSize: 12, color: "var(--color-accent-2-800)" }}>
            {enCarrito > 0
              ? `${enCarrito} en tu pedido`
              : `${combo.unidades} cookies a elección`}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onArmar}
          style={{ padding: "var(--space-2) var(--space-4)", fontSize: 14 }}
        >
          Armar la caja
        </button>
      </div>
    </div>
  );
}

function TarjetaProducto({
  producto,
  enCarrito,
  comprometidas,
  onSumar,
  onRestar,
}: {
  producto: ProductoVitrina;
  enCarrito: number;
  comprometidas: number;
  onSumar: () => void;
  onRestar: () => void;
}) {
  const restantes = producto.disponible - comprometidas;
  const agotado = restantes <= 0;

  return (
    <div
      style={{
        display: "grid",
        gap: "var(--space-3)",
        padding: "var(--space-6)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-bg)",
        border: "1px solid var(--color-divider)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <FotoProducto
        url={producto.fotoUrl}
        nombre={producto.nombre}
        alto={168}
        radio="var(--radius-md)"
      />

      <div style={{ display: "grid", gap: 4 }}>
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 17,
            lineHeight: 1.15,
          }}
        >
          {producto.nombre}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--color-neutral-600)",
            textWrap: "pretty",
          }}
        >
          {producto.descripcion}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 2 }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 18 }}>
            {money(producto.precio)}
          </span>
          <span style={{ fontSize: 12, color: colorStock(producto.disponible) }}>
            {etiquetaStock(producto.disponible, comprometidas)}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: 4,
            borderRadius: 999,
            background: "var(--color-neutral-200)",
          }}
        >
          <button
            type="button"
            onClick={onRestar}
            disabled={enCarrito === 0}
            aria-label={`Quitar una ${producto.nombre}`}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: 0,
              cursor: enCarrito === 0 ? "not-allowed" : "pointer",
              background: "var(--color-bg)",
              color: "var(--color-accent-600)",
              fontSize: 18,
              lineHeight: 1,
              opacity: enCarrito === 0 ? 0.45 : 1,
            }}
          >
            −
          </button>
          <span style={{ minWidth: 20, textAlign: "center", fontWeight: 600 }}>
            {enCarrito}
          </span>
          <button
            type="button"
            onClick={onSumar}
            disabled={agotado}
            aria-label={`Sumar una ${producto.nombre}`}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: 0,
              cursor: agotado ? "not-allowed" : "pointer",
              background: "var(--color-accent)",
              color: "#fff",
              fontSize: 18,
              lineHeight: 1,
              opacity: agotado ? 0.45 : 1,
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function etiquetaStock(disponible: number, comprometidas: number) {
  if (disponible === 0) return "agotada";
  const restantes = disponible - comprometidas;
  if (restantes <= 0) return "ya la sumaste toda";
  if (restantes <= 8) return `últimas ${restantes}`;
  return `${restantes} disponibles`;
}

function colorStock(disponible: number) {
  if (disponible === 0) return "var(--color-neutral-500)";
  if (disponible <= 8) return "var(--color-accent-2-700)";
  return "var(--color-neutral-600)";
}
