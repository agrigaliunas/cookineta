# La Cookineta

Pedidos de galletas por horneada semanal. Next.js (front + backend) sobre
Supabase (Postgres, Auth y Storage).

El prototipo estático original quedó en `_mockup/` como referencia visual.

## Cómo funciona un pedido

1. La clienta elige zona → día → franja y arma el carrito en la vitrina.
2. Al confirmar, la server action llama a la función `crear_pedido` de Postgres,
   que valida stock y precios **dentro de una transacción con las filas de stock
   bloqueadas** y guarda el pedido con estado `pendiente_whatsapp`.
3. El navegador abre WhatsApp hacia el número del negocio con el mensaje ya
   escrito. Si el navegador bloquea la apertura automática, la pantalla de
   confirmación tiene el botón con el mismo link.
4. El pedido queda en el panel **aunque la clienta nunca envíe el mensaje**.
5. Desde `/admin/pedidos` se confirma (con un link para avisarle por WhatsApp) y
   se lo hace avanzar: `confirmado → en horno → en reparto → entregado`.
   Cancelar libera las unidades reservadas.

## Puesta en marcha (local)

Necesitás Docker Desktop corriendo.

```bash
npm install
npx supabase start          # levanta Postgres, Auth, Storage y Studio
npx supabase db reset       # aplica la migración y carga los datos de ejemplo
```

`supabase start` imprime la `API URL` y la `anon key`. Copialas a `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<la anon key que imprimió>
NEXT_PUBLIC_WHATSAPP_NEGOCIO=5491137585499
```

Después:

```bash
npm run dev
```

- Vitrina: http://localhost:3000
- Panel: http://localhost:3000/admin (pide login)
- Supabase Studio: http://127.0.0.1:54323

### Crear la usuaria administradora

En Studio → Authentication → Add user, con "Auto Confirm User" tildado. No hay
registro público: cualquiera con sesión iniciada es administradora.

## Producción

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. `npx supabase login`, `npx supabase link --project-ref <ref>` y
   `npx supabase db push`.
3. Crear la usuaria administradora desde el dashboard
   (Authentication → Add user, con *Auto Confirm User*).
4. Deployar en Vercel con las tres variables `NEXT_PUBLIC_*` de arriba.
5. Desde `/admin`: abrir la primera horneada, cargar los productos y asignarle
   zona y franjas a cada día.

**`seed.sql` no corre en producción** — es sólo para local. Por eso las dos
zonas (Norte/Martínez y Sur/Wilde) van en la migración y no en el seed: son
estructurales, y sin zonas no se le puede asignar reparto a ningún día, así que
una base recién creada no podría tomar un solo pedido.

No hace falta la `service_role key` en ningún lado: todo pasa por RLS con la
identidad real de quien navega.

## Estructura

```
app/            rutas — / (vitrina), /login, /admin/{,horneada,stock,pedidos}
components/     cliente/ · admin/ · ui/
actions/        server actions: pedidos, stock, horneada, auth
lib/            supabase/ · consultas · whatsapp · money · fechas · constantes
supabase/       migrations/ + seed.sql
_mockup/        el prototipo estático original
```

## Decisiones que conviene no deshacer

- **`crear_pedido` es una función de Postgres, no código TypeScript.** Es lo que
  impide vender dos veces la última cookie y lo que garantiza que el precio
  cobrado sea el de la base y no el que mandó el navegador.
- **`horneada_stock.precio` congela el precio de la horneada.** Si sube el precio
  del producto a mitad de semana, quien ya vio $2.200 sigue pagando $2.200.
- **`money()` no usa `toLocaleString`.** Node y el navegador resuelven `es-AR`
  distinto y React tira error de hidratación.
- **Las fechas se formatean en el servidor** (`lib/fechas.ts`). `new Date('2026-08-03')`
  en el navegador se interpreta en UTC y en Argentina muestra el 2.
- **`v_disponibilidad` corre con permisos del dueño**, no del invocante: la
  clienta anónima tiene que ver cuántas unidades quedan sin poder leer los
  pedidos de las demás.
