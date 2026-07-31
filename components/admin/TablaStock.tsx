"use client";

import { useState, useTransition } from "react";
import { money, soloNumeros } from "@/lib/money";
import {
  crearProducto,
  editarProducto,
  fijarPlanificado,
  fijarPrecioHorneada,
  quitarDeHorneada,
} from "@/actions/stock";
import { fijarCategoriaProducto } from "@/actions/combos";
import FotoProducto from "@/components/ui/FotoProducto";
import SubirFoto from "@/components/ui/SubirFoto";

export type FilaStock = {
  id: string;
  nombre: string;
  descripcion: string;
  fotoUrl: string | null;
  categoriaId: string | null;
  precio: number;
  planificado: number;
  reservado: number;
  disponible: number;
};

export type OpcionCategoria = { id: string; nombre: string };

export default function TablaStock({
  horneadaId,
  filas,
  categorias,
}: {
  horneadaId: string;
  filas: FilaStock[];
  categorias: OpcionCategoria[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<FilaStock | null>(null);

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <p
        style={{
          margin: 0,
          color: "var(--color-neutral-600)",
          maxWidth: "62ch",
          textWrap: "pretty",
        }}
      >
        Planificá cuántas unidades entran al horno esta horneada. Lo reservado
        sale de los pedidos vivos —los confirmados, más los que están sin
        confirmar y todavía no se les venció la reserva—, así que el planificado
        nunca puede bajar de ahí. El vencimiento se cambia en Configuración.
      </p>

      {error && <Aviso texto={error} onCerrar={() => setError(null)} />}

      <div className="scroll-x">
        <table className="table" style={{ minWidth: 780 }}>
          <thead>
            <tr>
              <th>Foto</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th style={{ textAlign: "right" }}>Precio</th>
              <th style={{ textAlign: "center" }}>Planificado</th>
              <th style={{ textAlign: "right" }}>Reservado</th>
              <th style={{ textAlign: "right" }}>Disponible</th>
              <th style={{ textAlign: "right" }}>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <Fila
                key={f.id}
                fila={f}
                horneadaId={horneadaId}
                categorias={categorias}
                onError={setError}
                onEditar={() => setEditando(f)}
              />
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={9} style={{ color: "var(--color-neutral-600)" }}>
                  Esta horneada todavía no tiene productos en la vitrina.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editando ? (
        <FormularioProducto
          key={editando.id}
          titulo={`Editar “${editando.nombre}”`}
          inicial={editando}
          categorias={categorias}
          textoBoton="Guardar cambios"
          onCancelar={() => setEditando(null)}
          onEnviar={async (datos) => {
            const r = await editarProducto(editando.id, datos);
            if (r.ok) setEditando(null);
            return r;
          }}
        />
      ) : (
        <FormularioProducto
          titulo="Nuevo producto"
          textoBoton="Agregar a la vitrina"
          categorias={categorias}
          conPlanificado
          onEnviar={(datos) =>
            crearProducto(horneadaId, {
              ...datos,
              planificado: datos.planificado ?? 0,
            })
          }
        />
      )}
    </div>
  );
}

function Fila({
  fila,
  horneadaId,
  categorias,
  onError,
  onEditar,
}: {
  fila: FilaStock;
  horneadaId: string;
  categorias: OpcionCategoria[];
  onError: (e: string) => void;
  onEditar: () => void;
}) {
  const [pendiente, startTransition] = useTransition();
  const [precio, setPrecio] = useState(String(fila.precio));

  const ratio = fila.planificado ? fila.disponible / fila.planificado : 0;
  const estado =
    fila.disponible === 0 ? "Agotado" : ratio < 0.25 ? "Casi sin stock" : "En stock";
  const claseTag =
    fila.disponible === 0
      ? "tag-neutral"
      : ratio < 0.25
        ? "tag-accent-2"
        : "tag-accent";

  function ajustar(delta: number) {
    startTransition(async () => {
      const r = await fijarPlanificado(
        horneadaId,
        fila.id,
        fila.planificado + delta,
      );
      if (!r.ok) onError(r.error);
    });
  }

  return (
    <tr style={{ opacity: pendiente ? 0.6 : 1 }}>
      <td>
        <FotoProducto
          url={fila.fotoUrl}
          nombre={fila.nombre}
          alto={48}
          ancho={64}
          radio="var(--radius-sm)"
        />
      </td>
      <td style={{ fontWeight: 600 }}>{fila.nombre}</td>
      <td>
        <select
          className="input"
          value={fila.categoriaId ?? ""}
          disabled={pendiente}
          aria-label={`Categoría de ${fila.nombre}`}
          onChange={(e) => {
            const valor = e.target.value || null;
            startTransition(async () => {
              const r = await fijarCategoriaProducto(fila.id, valor);
              if (!r.ok) onError(r.error);
            });
          }}
          style={{ minWidth: 170, cursor: "pointer" }}
        >
          <option value="">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </td>
      <td style={{ textAlign: "right" }}>
        <input
          className="input"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          onBlur={() => {
            const v = soloNumeros(precio);
            setPrecio(String(v));
            if (v !== fila.precio) {
              startTransition(async () => {
                const r = await fijarPrecioHorneada(horneadaId, fila.id, v);
                if (!r.ok) onError(r.error);
              });
            }
          }}
          style={{ width: 100, textAlign: "right" }}
          aria-label={`Precio de ${fila.nombre} en esta horneada`}
        />
      </td>
      <td>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
          }}
        >
          <BotonAjuste
            onClick={() => ajustar(-1)}
            disabled={pendiente || fila.planificado <= fila.reservado}
            etiqueta={`Restar 1 a ${fila.nombre}`}
          >
            −
          </BotonAjuste>
          <span
            style={{
              minWidth: 30,
              textAlign: "center",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fila.planificado}
          </span>
          <BotonAjuste
            onClick={() => ajustar(1)}
            disabled={pendiente}
            etiqueta={`Sumar 1 a ${fila.nombre}`}
          >
            +
          </BotonAjuste>
        </div>
      </td>
      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {fila.reservado}
      </td>
      <td
        style={{
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
        }}
      >
        {fila.disponible}
      </td>
      <td style={{ textAlign: "right" }}>
        <span className={`tag ${claseTag}`}>{estado}</span>
      </td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <button
          type="button"
          className="btn"
          onClick={onEditar}
          style={{ fontSize: 12, padding: "var(--space-1) var(--space-3)" }}
        >
          Editar
        </button>
        <button
          type="button"
          className="btn"
          disabled={pendiente || fila.reservado > 0}
          title={
            fila.reservado > 0
              ? "Tiene pedidos: cancelalos antes de sacarlo"
              : "Sacar de esta horneada"
          }
          onClick={() =>
            startTransition(async () => {
              const r = await quitarDeHorneada(horneadaId, fila.id);
              if (!r.ok) onError(r.error);
            })
          }
          style={{
            fontSize: 12,
            padding: "var(--space-1) var(--space-3)",
            color: "var(--color-neutral-600)",
          }}
        >
          Sacar
        </button>
      </td>
    </tr>
  );
}

function BotonAjuste({
  onClick,
  disabled,
  etiqueta,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        border: "1px solid var(--color-divider)",
        cursor: disabled ? "not-allowed" : "pointer",
        background: "var(--color-bg)",
        color: "var(--color-accent-600)",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

type DatosProducto = {
  nombre: string;
  descripcion: string;
  precio: number;
  fotoUrl: string | null;
  categoriaId: string | null;
  planificado?: number;
};

function FormularioProducto({
  titulo,
  textoBoton,
  inicial,
  categorias,
  conPlanificado = false,
  onEnviar,
  onCancelar,
}: {
  titulo: string;
  textoBoton: string;
  inicial?: FilaStock;
  categorias: OpcionCategoria[];
  conPlanificado?: boolean;
  onEnviar: (
    datos: DatosProducto,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  onCancelar?: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [precio, setPrecio] = useState(inicial ? String(inicial.precio) : "");
  const [planificado, setPlanificado] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(inicial?.fotoUrl ?? null);
  const [categoriaId, setCategoriaId] = useState<string>(
    inicial?.categoriaId ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const valido = nombre.trim() !== "" && soloNumeros(precio) > 0;

  function enviar() {
    setError(null);
    startTransition(async () => {
      const r = await onEnviar({
        nombre,
        descripcion,
        precio: soloNumeros(precio),
        fotoUrl,
        categoriaId: categoriaId || null,
        planificado: soloNumeros(planificado),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (!inicial) {
        setNombre("");
        setDescripcion("");
        setPrecio("");
        setPlanificado("");
        setFotoUrl(null);
        setCategoriaId("");
      }
    });
  }

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
      <div style={{ display: "grid", gap: "var(--space-1)" }}>
        <h3 style={{ margin: 0, fontSize: 19 }}>{titulo}</h3>
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-neutral-600)" }}>
          La foto se carga con un clic o arrastrando una imagen sobre el
          recuadro.
        </p>
      </div>

      <div className="grid-producto">
        <SubirFoto
          url={fotoUrl}
          nombre={nombre || "Foto del producto"}
          alto={112}
          ancho={150}
          onCambio={setFotoUrl}
        />

        <div className="grid-form-2">
          <Campo etiqueta="Nombre" valor={nombre} onChange={setNombre} placeholder="Cookie de limón" />
          <Campo
            etiqueta="Precio por unidad"
            valor={precio}
            onChange={setPrecio}
            placeholder="2300"
            inputMode="numeric"
          />
          <Campo
            etiqueta="Descripción"
            valor={descripcion}
            onChange={setDescripcion}
            placeholder="Masa de limón con glaseado"
          />
          <div className="field" style={{ display: "grid", gap: "var(--space-2)" }}>
            <label>Categoría</label>
            <select
              className="input"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              style={{ cursor: "pointer" }}
            >
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          {conPlanificado && (
            <Campo
              etiqueta="Unidades a hornear"
              valor={planificado}
              onChange={setPlanificado}
              placeholder="24"
              inputMode="numeric"
            />
          )}
        </div>
      </div>

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
          onClick={enviar}
          disabled={!valido || pendiente}
          style={{ borderRadius: 999, padding: "var(--space-3) var(--space-6)" }}
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
            ? conPlanificado
              ? `Se agrega con ${soloNumeros(planificado)} unidades planificadas.`
              : `Se guarda con precio ${money(soloNumeros(precio))}.`
            : "Necesita al menos nombre y precio."}
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
        style={{
          background: "none",
          border: 0,
          cursor: "pointer",
          color: "inherit",
        }}
        aria-label="Cerrar aviso"
      >
        ×
      </button>
    </div>
  );
}
