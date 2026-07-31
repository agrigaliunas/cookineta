"use client";

import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import FotoProducto from "./FotoProducto";

/**
 * Sube la foto a Supabase Storage y devuelve la URL pública.
 * Acepta clic o arrastrar la imagen encima, como el <image-slot> del mockup.
 */
export default function SubirFoto({
  url,
  nombre,
  alto = 112,
  ancho,
  onCambio,
}: {
  url: string | null;
  nombre: string;
  alto?: number;
  ancho?: number;
  onCambio: (url: string | null) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function subir(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Eso no es una imagen.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La foto no puede pesar más de 5 MB.");
      return;
    }

    setSubiendo(true);
    setError(null);

    const supabase = supabaseBrowser();
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const ruta = `${crypto.randomUUID()}.${extension}`;

    const { error: errorSubida } = await supabase.storage
      .from("productos")
      .upload(ruta, file, { cacheControl: "31536000", upsert: false });

    setSubiendo(false);

    if (errorSubida) {
      setError("No se pudo subir la foto. Probá de nuevo.");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("productos").getPublicUrl(ruta);

    onCambio(publicUrl);
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-1)" }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void subir(file);
        }}
        style={{
          position: "relative",
          cursor: "pointer",
          borderRadius: "var(--radius-md)",
          outline: encima ? "2px dashed var(--color-accent-500)" : "none",
          outlineOffset: 2,
          width: ancho ?? "100%",
        }}
        title="Clic o arrastrá una imagen"
      >
        <FotoProducto url={url} nombre={nombre || "Foto"} alto={alto} ancho={ancho} />
        {(subiendo || !url) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              textAlign: "center",
              padding: "var(--space-1)",
              color: "var(--color-accent-2-800)",
              background: subiendo
                ? "color-mix(in srgb, var(--color-bg) 70%, transparent)"
                : "transparent",
              borderRadius: "var(--radius-md)",
              pointerEvents: "none",
            }}
          >
            {subiendo ? "Subiendo…" : ""}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void subir(file);
          e.target.value = "";
        }}
      />

      {url && !subiendo && (
        <button
          type="button"
          onClick={() => onCambio(null)}
          style={{
            background: "none",
            border: 0,
            padding: 0,
            cursor: "pointer",
            fontSize: 11,
            color: "var(--color-neutral-600)",
            justifySelf: "start",
          }}
        >
          Quitar foto
        </button>
      )}

      {error && (
        <span style={{ fontSize: 11, color: "var(--color-accent-2-800)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
