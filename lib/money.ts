/**
 * Formato de plata, en pesos enteros.
 *
 * A propósito NO usa `toLocaleString('es-AR')`: Node y el navegador pueden
 * resolver la misma locale con separadores distintos y React tira un error de
 * hydration cuando el HTML del servidor no coincide con el del cliente.
 * El separador de miles se arma a mano, así el resultado es idéntico en ambos.
 */
export function money(n: number): string {
  const entero = Math.round(Math.abs(n));
  const signo = n < 0 ? "-" : "";
  return signo + "$" + separarMiles(entero);
}

export function separarMiles(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ".";
    out += s[i];
  }
  return out;
}

/** Deja solo dígitos y lo interpreta como entero. Para los inputs de precio. */
export function soloNumeros(v: string | number): number {
  return Math.max(0, Number(String(v).replace(/[^0-9]/g, "")) || 0);
}
