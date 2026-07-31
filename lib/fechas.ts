/**
 * Las fechas de la horneada son `date` de Postgres (sin hora) y llegan como
 * 'YYYY-MM-DD'. Se formatean SIEMPRE acá, en el servidor, y viajan al cliente
 * como string ya armado.
 *
 * `new Date('2026-08-03')` en el navegador lo interpreta como UTC medianoche y
 * en Argentina (UTC-3) muestra el 2. Por eso todo se parsea a mano.
 */

const DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** 'YYYY-MM-DD' → {anio, mes (1-12), dia} sin pasar por Date. */
export function partes(iso: string) {
  const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return { anio, mes, dia };
}

/** Día de la semana 0-6, por Zeller, sin zonas horarias de por medio. */
export function diaSemana(iso: string): number {
  const { anio, mes, dia } = partes(iso);
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const y = mes < 3 ? anio - 1 : anio;
  return (
    (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[mes - 1] + dia) % 7
  );
}

/** 'Lunes' */
export function nombreDia(iso: string): string {
  return DIAS[diaSemana(iso)];
}

/** 'Lunes 3/8' — el formato corto del mockup. */
export function diaCorto(iso: string): string {
  const { mes, dia } = partes(iso);
  return `${nombreDia(iso)} ${dia}/${mes}`;
}

/** '3 de agosto' */
export function diaLargo(iso: string): string {
  const { mes, dia } = partes(iso);
  return `${dia} de ${MESES[mes - 1]}`;
}

/** '3 al 9 de agosto' — el rango del encabezado de la horneada. */
export function rangoHorneada(desdeIso: string, hastaIso: string): string {
  const a = partes(desdeIso);
  const b = partes(hastaIso);
  if (a.mes === b.mes) return `${a.dia} al ${b.dia} de ${MESES[b.mes - 1]}`;
  return `${a.dia} de ${MESES[a.mes - 1]} al ${b.dia} de ${MESES[b.mes - 1]}`;
}

/** Suma días a una fecha ISO manteniéndola como fecha pura. */
export function sumarDias(iso: string, n: number): string {
  const { anio, mes, dia } = partes(iso);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Fecha de hoy en Argentina, como 'YYYY-MM-DD'. */
export function hoyArgentina(): string {
  const ahora = new Date();
  const arg = new Date(ahora.getTime() - 3 * 60 * 60 * 1000);
  return arg.toISOString().slice(0, 10);
}
