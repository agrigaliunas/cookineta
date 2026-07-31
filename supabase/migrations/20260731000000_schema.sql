-- ═══════════════════════════════════════════════════════════════════════════
-- La Cookineta — esquema inicial
--
-- Toda la plata se guarda como pesos enteros (integer); el formateo vive en
-- lib/money.ts. Las franjas horarias se guardan como índice sobre el array
-- FRANJAS de lib/constantes.ts.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Zonas de reparto ───────────────────────────────────────────────────────
create table public.zonas (
  id      text primary key,               -- 'norte' | 'sur'
  nombre  text    not null,               -- 'Zona Norte'
  hub     text    not null,               -- 'Martínez'
  envio   integer not null default 0 check (envio >= 0),
  activa  boolean not null default true,
  orden   integer not null default 0
);

-- Las dos zonas van en la migración y no en seed.sql: seed sólo corre en local,
-- y sin zonas no se le puede asignar reparto a ningún día — o sea que una base
-- de producción recién creada no podría tomar un solo pedido. Los precios se
-- ajustan después desde /admin/horneada.
insert into public.zonas (id, nombre, hub, envio, orden) values
  ('norte', 'Zona Norte', 'Martínez', 1500, 1),
  ('sur',   'Zona Sur',   'Wilde',    1300, 2);

-- ── Productos ──────────────────────────────────────────────────────────────
create table public.productos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text    not null,
  descripcion text    not null default '',
  precio      integer not null check (precio >= 0),
  foto_url    text,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- ── Horneadas (la semana de producción) ────────────────────────────────────
create table public.horneadas (
  id                 uuid primary key default gen_random_uuid(),
  numero             integer not null unique,
  fecha_inicio       date    not null,
  fecha_fin          date    not null,
  estado             text    not null default 'abierta'
                       check (estado in ('borrador', 'abierta', 'cerrada')),
  envio_gratis_desde integer not null default 20000 check (envio_gratis_desde >= 0),
  creada_en          timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);

-- Sólo puede haber una horneada abierta a la vez: es la que ve el cliente.
create unique index horneadas_una_abierta
  on public.horneadas (estado) where estado = 'abierta';

-- ── Días de la horneada ────────────────────────────────────────────────────
-- zona_id null = "día libre": el cliente no lo ve.
create table public.horneada_dias (
  id          uuid primary key default gen_random_uuid(),
  horneada_id uuid not null references public.horneadas (id) on delete cascade,
  fecha       date not null,
  zona_id     text references public.zonas (id) on delete set null,
  franjas     smallint[] not null default '{}',
  unique (horneada_id, fecha)
);

create index horneada_dias_horneada on public.horneada_dias (horneada_id);

-- ── Plan de stock por horneada ─────────────────────────────────────────────
-- `precio` es el precio congelado para esa horneada: si mañana sube el precio
-- del producto, la horneada en curso sigue cobrando lo que se publicó.
create table public.horneada_stock (
  horneada_id uuid    not null references public.horneadas (id) on delete cascade,
  producto_id uuid    not null references public.productos (id) on delete cascade,
  planificado integer not null default 0 check (planificado >= 0),
  precio      integer not null check (precio >= 0),
  primary key (horneada_id, producto_id)
);

-- ── Pedidos ────────────────────────────────────────────────────────────────
create sequence public.pedido_codigo_seq start 241;

create table public.pedidos (
  id               uuid primary key default gen_random_uuid(),
  codigo           integer not null unique default nextval('public.pedido_codigo_seq'),
  horneada_id      uuid not null references public.horneadas (id),
  horneada_dia_id  uuid not null references public.horneada_dias (id),
  zona_id          text not null references public.zonas (id),
  franja_idx       smallint not null,
  cliente_nombre   text not null,
  cliente_telefono text not null,
  direccion        text not null,
  nota             text not null default '',
  subtotal         integer not null check (subtotal >= 0),
  envio            integer not null check (envio >= 0),
  total            integer not null check (total >= 0),
  estado           text not null default 'pendiente_whatsapp'
                     check (estado in ('pendiente_whatsapp', 'confirmado', 'en_horno',
                                       'en_reparto', 'entregado', 'cancelado')),
  confirmado_en    timestamptz,
  creado_en        timestamptz not null default now()
);

create index pedidos_horneada on public.pedidos (horneada_id);
create index pedidos_estado   on public.pedidos (estado);

alter sequence public.pedido_codigo_seq owned by public.pedidos.codigo;

-- `nombre` y `precio_unitario` son snapshots: los pedidos viejos siguen
-- mostrando lo que se cobró aunque después cambie el producto.
create table public.pedido_items (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references public.pedidos (id) on delete cascade,
  producto_id     uuid not null references public.productos (id),
  nombre          text not null,
  precio_unitario integer not null check (precio_unitario >= 0),
  cantidad        integer not null check (cantidad > 0)
);

create index pedido_items_pedido   on public.pedido_items (pedido_id);
create index pedido_items_producto on public.pedido_items (producto_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Vistas
-- ═══════════════════════════════════════════════════════════════════════════

-- Reemplaza reservedFor() / available() del mockup.
-- Los pedidos 'pendiente_whatsapp' SÍ reservan; sólo 'cancelado' libera.
--
-- A propósito NO lleva security_invoker: corre con los permisos del dueño de la
-- vista. El cliente anónimo tiene que ver cuántas unidades quedan, pero no puede
-- leer pedido_items — con security_invoker el agregado le daría siempre 0 y la
-- vitrina mostraría stock que no existe. La vista sólo expone totales, nunca
-- datos de otros clientes.
create view public.v_disponibilidad as
select
  hs.horneada_id,
  hs.producto_id,
  hs.planificado,
  hs.precio,
  coalesce(r.reservado, 0)                               as reservado,
  greatest(0, hs.planificado - coalesce(r.reservado, 0)) as disponible
from public.horneada_stock hs
left join lateral (
  select sum(pi.cantidad)::integer as reservado
  from public.pedido_items pi
  join public.pedidos p on p.id = pi.pedido_id
  where pi.producto_id = hs.producto_id
    and p.horneada_id  = hs.horneada_id
    and p.estado <> 'cancelado'
) r on true;

grant select on public.v_disponibilidad to anon, authenticated;

-- Ventas por línea, para el panel. Resuelve en SQL lo que el mockup calculaba
-- en el navegador (líneas 749-774). Ésta sí respeta RLS: es sólo para la admin.
create view public.v_ventas
with (security_invoker = true) as
select
  p.horneada_id,
  p.id          as pedido_id,
  p.zona_id,
  p.horneada_dia_id,
  hd.fecha,
  p.estado,
  pi.producto_id,
  pi.nombre     as producto_nombre,
  pi.precio_unitario,
  pi.cantidad,
  (pi.precio_unitario * pi.cantidad) as ingreso
from public.pedidos p
join public.pedido_items pi  on pi.pedido_id = p.id
join public.horneada_dias hd on hd.id = p.horneada_dia_id
where p.estado <> 'cancelado';

grant select on public.v_ventas to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- crear_pedido — la única escritura que puede hacer un visitante anónimo.
--
-- Corre entera en una transacción y con SECURITY DEFINER. Bloquea las filas de
-- stock antes de leer la disponibilidad, así dos personas que compran la última
-- cookie al mismo tiempo no la venden dos veces. Y recalcula los precios desde
-- la base: nunca confía en los que manda el navegador.
--
-- payload: {
--   horneada_dia_id: uuid, franja_idx: int,
--   cliente_nombre, cliente_telefono, direccion, nota,
--   items: [{ producto_id: uuid, cantidad: int }]
-- }
-- ═══════════════════════════════════════════════════════════════════════════
create function public.crear_pedido(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dia            public.horneada_dias%rowtype;
  v_horneada       public.horneadas%rowtype;
  v_zona           public.zonas%rowtype;
  v_item           jsonb;
  v_producto_id    uuid;
  v_cantidad       integer;
  v_precio         integer;
  v_nombre         text;
  v_disponible     integer;
  v_subtotal       integer := 0;
  v_envio          integer;
  v_pedido_id      uuid;
  v_codigo         integer;
  v_franja_idx     integer;
  v_nombre_cliente text;
  v_telefono       text;
  v_direccion      text;
  v_items          jsonb := coalesce(payload -> 'items', '[]'::jsonb);
  v_lineas         jsonb := '[]'::jsonb;
begin
  v_nombre_cliente := btrim(coalesce(payload ->> 'cliente_nombre', ''));
  v_telefono       := btrim(coalesce(payload ->> 'cliente_telefono', ''));
  v_direccion      := btrim(coalesce(payload ->> 'direccion', ''));

  if v_nombre_cliente = '' or v_telefono = '' or v_direccion = '' then
    raise exception 'Faltan datos de contacto: nombre, WhatsApp y dirección son obligatorios.'
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(v_items) = 0 then
    raise exception 'El pedido no tiene productos.' using errcode = 'check_violation';
  end if;

  -- El día manda: de ahí salen la horneada y la zona. El cliente no las elige
  -- por separado, así que no puede pedir "Zona Sur" con un día de Zona Norte.
  select * into v_dia
  from public.horneada_dias
  where id = (payload ->> 'horneada_dia_id')::uuid;

  if not found then
    raise exception 'El día de entrega elegido ya no existe.' using errcode = 'no_data_found';
  end if;

  if v_dia.zona_id is null then
    raise exception 'Ese día quedó sin reparto asignado. Elegí otro.'
      using errcode = 'check_violation';
  end if;

  select * into v_horneada from public.horneadas where id = v_dia.horneada_id;

  if v_horneada.estado <> 'abierta' then
    raise exception 'La horneada ya está cerrada. Escribinos por WhatsApp.'
      using errcode = 'check_violation';
  end if;

  select * into v_zona from public.zonas where id = v_dia.zona_id;

  v_franja_idx := (payload ->> 'franja_idx')::integer;
  if v_franja_idx is null or not (v_franja_idx = any (v_dia.franjas)) then
    raise exception 'La franja horaria elegida no está disponible ese día.'
      using errcode = 'check_violation';
  end if;

  -- Bloqueo pesimista sobre el stock de esta horneada: serializa los pedidos
  -- simultáneos que tocan los mismos productos. Sin esto, dos personas compran
  -- la última cookie al mismo tiempo y las dos se la llevan.
  perform 1
  from public.horneada_stock hs
  where hs.horneada_id = v_horneada.id
    and hs.producto_id in (
      select (value ->> 'producto_id')::uuid from jsonb_array_elements(v_items)
    )
  for update;

  -- Las líneas se agrupan por producto ANTES de validar. Si el payload manda el
  -- mismo producto dos veces, validar cada línea por separado dejaría pasar la
  -- suma: con 4 disponibles, dos líneas de 3 pasarían las dos.
  for v_item in
    select jsonb_build_object('producto_id', t.producto_id, 'cantidad', t.cantidad)
    from (
      select (value ->> 'producto_id')::uuid   as producto_id,
             sum((value ->> 'cantidad')::integer) as cantidad
      from jsonb_array_elements(v_items)
      group by 1
    ) t
  loop
    v_producto_id := (v_item ->> 'producto_id')::uuid;
    v_cantidad    := (v_item ->> 'cantidad')::integer;

    if v_producto_id is null then
      raise exception 'Producto inválido.' using errcode = 'check_violation';
    end if;

    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida.' using errcode = 'check_violation';
    end if;

    -- El precio sale de horneada_stock, jamás del payload.
    select d.disponible, d.precio, pr.nombre
      into v_disponible, v_precio, v_nombre
    from public.v_disponibilidad d
    join public.productos pr on pr.id = d.producto_id
    where d.horneada_id = v_horneada.id
      and d.producto_id = v_producto_id;

    if not found then
      raise exception 'Uno de los productos ya no está en esta horneada.'
        using errcode = 'no_data_found';
    end if;

    if v_disponible < v_cantidad then
      raise exception 'Ya no quedan % unidades de %. Quedan %.',
        v_cantidad, v_nombre, v_disponible
        using errcode = 'check_violation';
    end if;

    v_subtotal := v_subtotal + v_precio * v_cantidad;
    v_lineas := v_lineas || jsonb_build_object(
      'producto_id', v_producto_id,
      'nombre',      v_nombre,
      'precio',      v_precio,
      'cantidad',    v_cantidad
    );
  end loop;

  v_envio := case
    when v_subtotal >= v_horneada.envio_gratis_desde then 0
    else v_zona.envio
  end;

  insert into public.pedidos (
    horneada_id, horneada_dia_id, zona_id, franja_idx,
    cliente_nombre, cliente_telefono, direccion, nota,
    subtotal, envio, total
  ) values (
    v_horneada.id, v_dia.id, v_zona.id, v_franja_idx,
    v_nombre_cliente, v_telefono, v_direccion,
    btrim(coalesce(payload ->> 'nota', '')),
    v_subtotal, v_envio, v_subtotal + v_envio
  )
  returning id, codigo into v_pedido_id, v_codigo;

  insert into public.pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad)
  select v_pedido_id,
         (l ->> 'producto_id')::uuid,
         l ->> 'nombre',
         (l ->> 'precio')::integer,
         (l ->> 'cantidad')::integer
  from jsonb_array_elements(v_lineas) l;

  return jsonb_build_object(
    'pedido_id', v_pedido_id,
    'codigo',    v_codigo,
    'subtotal',  v_subtotal,
    'envio',     v_envio,
    'total',     v_subtotal + v_envio,
    'zona',      v_zona.nombre,
    'hub',       v_zona.hub,
    'fecha',     v_dia.fecha,
    'lineas',    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nombre',   l ->> 'nombre',
        'cantidad', (l ->> 'cantidad')::integer,
        'total',    (l ->> 'precio')::integer * (l ->> 'cantidad')::integer
      )), '[]'::jsonb)
      from jsonb_array_elements(v_lineas) l
    )
  );
end;
$$;

revoke all on function public.crear_pedido(jsonb) from public;
grant execute on function public.crear_pedido(jsonb) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
--
-- El visitante anónimo lee el catálogo y nada más. Los pedidos son invisibles
-- para `anon` y sólo entran por crear_pedido(). Como hay una sola usuaria (tu
-- hermana), `authenticated` = administradora.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.zonas           enable row level security;
alter table public.productos       enable row level security;
alter table public.horneadas       enable row level security;
alter table public.horneada_dias   enable row level security;
alter table public.horneada_stock  enable row level security;
alter table public.pedidos         enable row level security;
alter table public.pedido_items    enable row level security;

-- Lectura pública del catálogo
create policy "zonas visibles" on public.zonas
  for select to anon, authenticated using (activa);

create policy "productos activos visibles" on public.productos
  for select to anon, authenticated using (activo);

create policy "horneada abierta visible" on public.horneadas
  for select to anon, authenticated using (estado = 'abierta');

create policy "dias de horneada abierta visibles" on public.horneada_dias
  for select to anon, authenticated
  using (exists (
    select 1 from public.horneadas h
    where h.id = horneada_dias.horneada_id and h.estado = 'abierta'
  ));

create policy "stock de horneada abierta visible" on public.horneada_stock
  for select to anon, authenticated
  using (exists (
    select 1 from public.horneadas h
    where h.id = horneada_stock.horneada_id and h.estado = 'abierta'
  ));

-- La administradora ve y escribe todo.
create policy "admin total zonas" on public.zonas
  for all to authenticated using (true) with check (true);
create policy "admin total productos" on public.productos
  for all to authenticated using (true) with check (true);
create policy "admin total horneadas" on public.horneadas
  for all to authenticated using (true) with check (true);
create policy "admin total dias" on public.horneada_dias
  for all to authenticated using (true) with check (true);
create policy "admin total stock" on public.horneada_stock
  for all to authenticated using (true) with check (true);
create policy "admin total pedidos" on public.pedidos
  for all to authenticated using (true) with check (true);
create policy "admin total items" on public.pedido_items
  for all to authenticated using (true) with check (true);

-- Sin policy para `anon` sobre pedidos / pedido_items: quedan cerrados.

-- ═══════════════════════════════════════════════════════════════════════════
-- Storage: fotos de productos
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

create policy "fotos de productos son publicas" on storage.objects
  for select to anon, authenticated using (bucket_id = 'productos');

create policy "solo la admin sube fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'productos');

create policy "solo la admin reemplaza fotos" on storage.objects
  for update to authenticated using (bucket_id = 'productos');

create policy "solo la admin borra fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'productos');
