"use client";

import { useState, useTransition } from "react";
import { money, soloNumeros } from "@/lib/money";
import {
  crearCategoria,
  crearCombo,
  desactivarCategoria,
  editarCombo,
  fijarPrecioComboHorneada,
  quitarComboDeHorneada,
  renombrarCategoria,
  type RanuraNueva,
} from "@/actions/combos";
import FotoProducto from "@/components/ui/FotoProducto";
import SubirFoto from "@/components/ui/SubirFoto";

export type CategoriaAdmin = {
  id: string;
  nombre: string;
  /** Cuántas cookies activas tiene: una vacía no sirve en un combo. */
  productos: number;
};

export type ComboAdmin = {
  id: string;
  nombre: string;
  descripcion: string;
  fotoUrl: string | null;
  precio: number;
  /** Precio con el que se cobra en la horneada abierta, o null si no está. */
  precioHorneada: number | null;
  ranuras: { categoriaId: string; cantidad: number }[];
};

export default function GestionCombos({
  horneadaId,
  categorias,
  combos,
}: {
  horneadaId: string | null;
  categorias: CategoriaAdmin[];
  combos: ComboAdmin[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<ComboAdmin | null>(null);

  return (
    <div style={{ display: "grid", gap: "var(--space-8)" }}>
      {error && <Aviso texto={error} onCerrar={() => setError(null)} />}

      <section style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gap: "var(--space-1)" }}>
          <h3 style={{ margin: 0, fontSize: 22 }}>Categorías</h3>
          <p
            style={{
              margin: 0,
              color: "var(--color-neutral-600)",
              maxWidth: "62ch",
              textWrap: "pretty",
            }}
          >
            Agrupan las cookies en la vitrina y son de lo que se arman los
            combos. Cada cookie se asigna a su categoría desde la pestaña Stock.
          </p>
        </div>

        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          {categorias.map((c) => (
            <FilaCategoria key={c.id} categoria={c} onError={setError} />
          ))}
        </div>

        <NuevaCategoria onError={setError} />
      </section>

      <section style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gap: "var(--space-1)" }}>
          <h3 style={{ margin: 0, fontSize: 22 }}>Combos para compartir</h3>
          <p
            style={{
              margin: 0,
              color: "var(--color-neutral-600)",
              maxWidth: "62ch",
              textWrap: "pretty",
            }}
          >
            Una caja a precio fijo con lugares por categoría. La clienta elige
            qué cookie va en cada lugar, y esas unidades se descuentan del stock
            igual que una cookie suelta.
          </p>
        </div>

        {combos.length === 0 ? (
          <p style={{ color: "var(--color-neutral-600)" }}>
            Todavía no creaste ningún combo.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {combos.map((c) => (
              <FilaCombo
                key={c.id}
                combo={c}
                categorias={categorias}
                horneadaId={horneadaId}
                onError={setError}
                onEditar={() => setEditando(c)}
              />
            ))}
          </div>
        )}

        {!horneadaId && (
          <Aviso
            texto="No hay ninguna horneada abierta, así que los combos nuevos no van a aparecer en la vitrina hasta que abras una."
            onCerrar={() => {}}
          />
        )}

        {editando ? (
          <FormularioCombo
            key={editando.id}
            titulo={`Editar “${editando.nombre}”`}
            textoBoton="Guardar cambios"
            categorias={categorias}
            inicial={editando}
            onCancelar={() => setEditando(null)}
            onEnviar={async (datos) => {
              const r = await editarCombo(editando.id, datos);
              if (r.ok) setEditando(null);
              return r;
            }}
          />
        ) : (
          horneadaId && (
            <FormularioCombo
              titulo="Nuevo combo"
              textoBoton="Crear el combo"
              categorias={categorias}
              onEnviar={(datos) => crearCombo(horneadaId, datos)}
            />
          )
        )}
      </section>
    </div>
  );
}

function FilaCategoria({
  categoria,
  onError,
}: {
  categoria: CategoriaAdmin;
  onError: (e: string) => void;
}) {
  const [nombre, setNombre] = useState(categoria.nombre);
  const [pendiente, startTransition] = useTransition();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-2) var(--space-4)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-bg)",
        border: "1px solid var(--color-divider)",
        opacity: pendiente ? 0.6 : 1,
        flexWrap: "wrap",
      }}
    >
      <input
        className="input"
        value={nombre}
        disabled={pendiente}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={() => {
          if (nombre.trim() && nombre !== categoria.nombre) {
            startTransition(async () => {
              const r = await renombrarCategoria(categoria.id, nombre);
              if (!r.ok) onError(r.error);
            });
          }
        }}
        style={{ maxWidth: 280 }}
        aria-label={`Nombre de ${categoria.nombre}`}
      />
      <span
        style={{
          fontSize: 13,
          color:
            categoria.productos === 0
              ? "var(--color-accent-2-800)"
              : "var(--color-neutral-600)",
          flex: 1,
        }}
      >
        {categoria.productos === 0
          ? "sin cookies asignadas"
          : `${categoria.productos} cookies`}
      </span>
      <button
        type="button"
        className="btn"
        disabled={pendiente}
        onClick={() =>
          startTransition(async () => {
            const r = await desactivarCategoria(categoria.id);
            if (!r.ok) onError(r.error);
          })
        }
        style={{
          fontSize: 12,
          padding: "var(--space-1) var(--space-3)",
          color: "var(--color-neutral-600)",
        }}
      >
        Desactivar
      </button>
    </div>
  );
}

function NuevaCategoria({ onError }: { onError: (e: string) => void }) {
  const [nombre, setNombre] = useState("");
  const [pendiente, startTransition] = useTransition();

  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-3)",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <input
        className="input"
        value={nombre}
        placeholder="Cookies de temporada"
        onChange={(e) => setNombre(e.target.value)}
        style={{ maxWidth: 280 }}
        aria-label="Nombre de la categoría nueva"
      />
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!nombre.trim() || pendiente}
        onClick={() =>
          startTransition(async () => {
            const r = await crearCategoria(nombre);
            if (r.ok) setNombre("");
            else onError(r.error);
          })
        }
        style={{ padding: "var(--space-2) var(--space-4)" }}
      >
        {pendiente ? "Creando…" : "Agregar categoría"}
      </button>
    </div>
  );
}

function FilaCombo({
  combo,
  categorias,
  horneadaId,
  onError,
  onEditar,
}: {
  combo: ComboAdmin;
  categorias: CategoriaAdmin[];
  horneadaId: string | null;
  onError: (e: string) => void;
  onEditar: () => void;
}) {
  const [pendiente, startTransition] = useTransition();
  const [precio, setPrecio] = useState(
    String(combo.precioHorneada ?? combo.precio),
  );

  const enVitrina = combo.precioHorneada !== null;
  const nombreCat = (id: string) =>
    categorias.find((c) => c.id === id)?.nombre ?? "Categoría";
  const unidades = combo.ranuras.reduce((n, r) => n + r.cantidad, 0);

  return (
    <div
      className="fila-pedido"
      style={{ opacity: pendiente ? 0.6 : 1, alignItems: "start" }}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--space-4)",
          alignItems: "flex-start",
          minWidth: 0,
        }}
      >
        <FotoProducto
          url={combo.fotoUrl}
          nombre={combo.nombre}
          alto={64}
          ancho={84}
          radio="var(--radius-sm)"
        />
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>
              {combo.nombre}
            </span>
            <span className={`tag ${enVitrina ? "tag-accent" : "tag-neutral"}`}>
              {enVitrina ? "en la vitrina" : "fuera de la horneada"}
            </span>
          </div>
          <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
            {combo.descripcion || "Sin descripción."}
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {combo.ranuras.map((r) => (
              <span key={r.categoriaId} className="tag tag-accent-2">
                {r.cantidad} {nombreCat(r.categoriaId)}
              </span>
            ))}
            <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
              {unidades} cookies en total
            </span>
          </div>
        </div>
      </div>

      <div className="fila-pedido-acciones">
        {enVitrina && horneadaId ? (
          <div className="field" style={{ display: "grid", gap: 4 }}>
            <label style={{ fontSize: 11 }}>Precio en esta horneada</label>
            <input
              className="input"
              value={precio}
              inputMode="numeric"
              disabled={pendiente}
              onChange={(e) => setPrecio(e.target.value)}
              onBlur={() => {
                const v = soloNumeros(precio);
                setPrecio(String(v));
                if (v !== combo.precioHorneada) {
                  startTransition(async () => {
                    const r = await fijarPrecioComboHorneada(
                      horneadaId,
                      combo.id,
                      v,
                    );
                    if (!r.ok) onError(r.error);
                  });
                }
              }}
              style={{ width: 130, textAlign: "right" }}
            />
          </div>
        ) : (
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 19 }}>
            {money(combo.precio)}
          </span>
        )}

        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onEditar}
            style={{ fontSize: 13, padding: "var(--space-2) var(--space-4)" }}
          >
            Editar
          </button>
          {enVitrina && horneadaId && (
            <button
              type="button"
              className="btn"
              disabled={pendiente}
              onClick={() =>
                startTransition(async () => {
                  const r = await quitarComboDeHorneada(horneadaId, combo.id);
                  if (!r.ok) onError(r.error);
                })
              }
              style={{
                fontSize: 13,
                padding: "var(--space-2) var(--space-4)",
                color: "var(--color-neutral-600)",
              }}
            >
              Sacar de la vitrina
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type DatosCombo = {
  nombre: string;
  descripcion: string;
  precio: number;
  fotoUrl: string | null;
  ranuras: RanuraNueva[];
};

function FormularioCombo({
  titulo,
  textoBoton,
  categorias,
  inicial,
  onEnviar,
  onCancelar,
}: {
  titulo: string;
  textoBoton: string;
  categorias: CategoriaAdmin[];
  inicial?: ComboAdmin;
  onEnviar: (d: DatosCombo) => Promise<{ ok: true } | { ok: false; error: string }>;
  onCancelar?: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [precio, setPrecio] = useState(inicial ? String(inicial.precio) : "");
  const [fotoUrl, setFotoUrl] = useState<string | null>(inicial?.fotoUrl ?? null);
  const [cantidades, setCantidades] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const c of categorias) {
      const r = inicial?.ranuras.find((x) => x.categoriaId === c.id);
      base[c.id] = r ? String(r.cantidad) : "";
    }
    return base;
  });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const ranuras: RanuraNueva[] = categorias
    .map((c) => ({ categoriaId: c.id, cantidad: soloNumeros(cantidades[c.id] ?? "") }))
    .filter((r) => r.cantidad > 0);

  const unidades = ranuras.reduce((n, r) => n + r.cantidad, 0);
  const valido = nombre.trim() !== "" && soloNumeros(precio) > 0 && ranuras.length > 0;

  // Una ranura sobre una categoría sin cookies nunca se va a poder completar.
  const vacias = ranuras
    .map((r) => categorias.find((c) => c.id === r.categoriaId))
    .filter((c) => c && c.productos === 0);

  return (
    <div
      style={{
        display: "grid",
        gap: "var(--space-4)",
        padding: "var(--space-6)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-surface)",
      }}
    >
      <h3 style={{ margin: 0, fontSize: 19 }}>{titulo}</h3>

      <div className="grid-producto">
        <SubirFoto
          url={fotoUrl}
          nombre={nombre || "Foto del combo"}
          alto={112}
          ancho={150}
          onCambio={setFotoUrl}
        />

        <div className="grid-form-2">
          <Campo
            etiqueta="Nombre"
            valor={nombre}
            onChange={setNombre}
            placeholder="Caja para compartir x9"
          />
          <Campo
            etiqueta="Precio de la caja"
            valor={precio}
            onChange={setPrecio}
            placeholder="17500"
            inputMode="numeric"
          />
          <div className="col-span-2">
            <Campo
              etiqueta="Descripción"
              valor={descripcion}
              onChange={setDescripcion}
              placeholder="Nueve cookies elegidas por vos, en caja para regalo."
            />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
          ¿Cuántas cookies de cada categoría entran?
        </span>
        <div className="grid-form-2">
          {categorias.map((c) => (
            <div
              key={c.id}
              className="field"
              style={{ display: "grid", gap: "var(--space-2)" }}
            >
              <label>
                {c.nombre}
                {c.productos === 0 && " (sin cookies)"}
              </label>
              <input
                className="input"
                value={cantidades[c.id] ?? ""}
                inputMode="numeric"
                placeholder="0"
                onChange={(e) =>
                  setCantidades((q) => ({ ...q, [c.id]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      {vacias.length > 0 && (
        <Aviso
          texto={`${vacias.map((c) => c!.nombre).join(" y ")} no tiene cookies asignadas: nadie va a poder completar esa parte de la caja.`}
          onCerrar={() => {}}
        />
      )}

      {error && <Aviso texto={error} onCerrar={() => setError(null)} />}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valido || pendiente}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await onEnviar({
                nombre,
                descripcion,
                precio: soloNumeros(precio),
                fotoUrl,
                ranuras,
              });
              if (!r.ok) {
                setError(r.error);
                return;
              }
              if (!inicial) {
                setNombre("");
                setDescripcion("");
                setPrecio("");
                setFotoUrl(null);
                setCantidades({});
              }
            });
          }}
          style={{ padding: "var(--space-3) var(--space-6)" }}
        >
          {pendiente ? "Guardando…" : textoBoton}
        </button>
        {onCancelar && (
          <button type="button" className="btn btn-secondary" onClick={onCancelar}>
            Cancelar
          </button>
        )}
        <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
          {valido
            ? `Caja de ${unidades} cookies a ${money(soloNumeros(precio))}.`
            : "Necesita nombre, precio y al menos una categoría con cantidad."}
        </span>
      </div>
    </div>
  );
}

function Campo({
  etiqueta,
  valor,
  onChange,
  placeholder,
  inputMode,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <div className="field" style={{ display: "grid", gap: "var(--space-2)" }}>
      <label>{etiqueta}</label>
      <input
        className="input"
        value={valor}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function Aviso({ texto, onCerrar }: { texto: string; onCerrar: () => void }) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--space-4)",
        fontSize: 13,
        color: "var(--color-accent-2-800)",
        background: "var(--color-accent-2-100)",
        border: "1px solid var(--color-accent-2-300)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3) var(--space-4)",
      }}
    >
      <span>{texto}</span>
      <button
        type="button"
        onClick={onCerrar}
        style={{ background: "none", border: 0, cursor: "pointer", color: "inherit" }}
        aria-label="Cerrar aviso"
      >
        ×
      </button>
    </div>
  );
}
