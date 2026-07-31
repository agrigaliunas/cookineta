-- ═══════════════════════════════════════════════════════════════════════════
-- Take away
--
-- El día de entrega ya trae la zona, y la zona trae su hub (Martínez, Wilde).
-- Ahora la clienta elige, para ese día, si se lo llevamos a la puerta o si lo
-- pasa a buscar por el hub.
--
-- Retirar no cuesta envío y no necesita dirección; el resto del flujo (día,
-- franja, stock, precios) es exactamente el mismo.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.pedidos
  add column entrega text not null default 'envio'
    check (entrega in ('envio', 'take_away'));

-- Los pedidos que ya existían son todos con envío, que es el default.
comment on column public.pedidos.entrega is
  'envio = a domicilio (cobra zonas.envio); take_away = retira en el hub de la zona (sin cargo, sin dirección)';

-- ═══════════════════════════════════════════════════════════════════════════
-- crear_pedido, ahora con la forma de entrega.
--
-- Cambios contra la versión anterior:
--   · payload.entrega ('envio' | 'take_away'), default 'envio'.
--   · la dirección sólo es obligatoria si es envío.
--   · take_away nunca cobra envío, sin importar el subtotal ni la zona.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.crear_pedido(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dia            public.horneada_dias%rowtype;
  v_horneada       public.horneadas%rowtype;
  v_zona           public.zonas%rowtype;
  v_combo_id       uuid;
  v_combo_nombre   text;
  v_item           jsonb;
  v_combo          jsonb;
  v_slot           record;
  v_producto_id    uuid;
  v_cantidad       integer;
  v_precio         integer;
  v_nombre         text;
  v_disponible     integer;
  v_subtotal       integer := 0;
  v_envio          integer;
  v_pedido_id      uuid;
  v_pedido_combo   uuid;
  v_codigo         integer;
  v_franja_idx     integer;
  v_nombre_cliente text;
  v_telefono       text;
  v_direccion      text;
  v_entrega        text;
  v_combo_precio   integer;
  v_combo_cant     integer;
  v_elegidas       integer;
  v_items          jsonb := coalesce(payload -> 'items',  '[]'::jsonb);
  v_combos         jsonb := coalesce(payload -> 'combos', '[]'::jsonb);
  v_demanda        jsonb := '[]'::jsonb;
  v_lineas         jsonb := '[]'::jsonb;
  v_detalle_combos jsonb := '[]'::jsonb;
begin
  v_nombre_cliente := btrim(coalesce(payload ->> 'cliente_nombre', ''));
  v_telefono       := btrim(coalesce(payload ->> 'cliente_telefono', ''));
  v_direccion      := btrim(coalesce(payload ->> 'direccion', ''));
  v_entrega        := coalesce(nullif(btrim(payload ->> 'entrega'), ''), 'envio');

  if v_entrega not in ('envio', 'take_away') then
    raise exception 'Forma de entrega inválida.' using errcode = 'check_violation';
  end if;

  if v_nombre_cliente = '' or v_telefono = '' then
    raise exception 'Faltan datos de contacto: nombre y WhatsApp son obligatorios.'
      using errcode = 'check_violation';
  end if;

  -- Quien retira no da dirección; quien pide envío, sí.
  if v_entrega = 'envio' and v_direccion = '' then
    raise exception 'Para el envío a domicilio necesitamos la dirección.'
      using errcode = 'check_violation';
  end if;

  if v_entrega = 'take_away' then
    v_direccion := '';
  end if;

  if jsonb_array_length(v_items) = 0 and jsonb_array_length(v_combos) = 0 then
    raise exception 'El pedido no tiene productos.' using errcode = 'check_violation';
  end if;

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

  -- Demanda unificada: sueltas + lo elegido dentro de cada combo.
  v_demanda := v_items;
  for v_combo in select * from jsonb_array_elements(v_combos) loop
    v_demanda := v_demanda || coalesce(v_combo -> 'elecciones', '[]'::jsonb);
  end loop;

  -- Bloqueo pesimista sobre todo lo que se va a tocar.
  perform 1
  from public.horneada_stock hs
  where hs.horneada_id = v_horneada.id
    and hs.producto_id in (
      select (value ->> 'producto_id')::uuid from jsonb_array_elements(v_demanda)
    )
  for update;

  -- ── validación de combos ────────────────────────────────────────────────
  for v_combo in select * from jsonb_array_elements(v_combos) loop
    v_combo_cant := coalesce((v_combo ->> 'cantidad')::integer, 1);

    if v_combo_cant <= 0 then
      raise exception 'Cantidad de combo inválida.' using errcode = 'check_violation';
    end if;

    select c.id, c.nombre, hc.precio
      into v_combo_id, v_combo_nombre, v_combo_precio
    from public.combos c
    join public.horneada_combos hc
      on hc.combo_id = c.id and hc.horneada_id = v_horneada.id
    where c.id = (v_combo ->> 'combo_id')::uuid and c.activo;

    if not found then
      raise exception 'Ese combo ya no está disponible en esta horneada.'
        using errcode = 'no_data_found';
    end if;

    -- Cada ranura tiene que quedar exacta: ni de menos ni de más.
    for v_slot in
      select ci.categoria_id, ci.cantidad, cat.nombre as categoria
      from public.combo_items ci
      join public.categorias cat on cat.id = ci.categoria_id
      where ci.combo_id = v_combo_id
    loop
      select coalesce(sum((e ->> 'cantidad')::integer), 0) into v_elegidas
      from jsonb_array_elements(coalesce(v_combo -> 'elecciones', '[]'::jsonb)) e
      join public.productos pr on pr.id = (e ->> 'producto_id')::uuid
      where pr.categoria_id = v_slot.categoria_id;

      if v_elegidas <> v_slot.cantidad * v_combo_cant then
        raise exception '% necesita % de %, y elegiste %.',
          v_combo_nombre, v_slot.cantidad * v_combo_cant, v_slot.categoria, v_elegidas
          using errcode = 'check_violation';
      end if;
    end loop;

    -- Y nada de colar cookies de una categoría que el combo no incluye.
    if exists (
      select 1
      from jsonb_array_elements(coalesce(v_combo -> 'elecciones', '[]'::jsonb)) e
      join public.productos pr on pr.id = (e ->> 'producto_id')::uuid
      where pr.categoria_id is null
         or pr.categoria_id not in (
           select ci.categoria_id from public.combo_items ci where ci.combo_id = v_combo_id
         )
    ) then
      raise exception 'Elegiste una cookie que no entra en %.', v_combo_nombre
        using errcode = 'check_violation';
    end if;

    v_subtotal := v_subtotal + v_combo_precio * v_combo_cant;
  end loop;

  -- ── stock, sobre la demanda unificada y agrupada por producto ───────────
  for v_item in
    select jsonb_build_object('producto_id', t.producto_id, 'cantidad', t.cantidad)
    from (
      select (value ->> 'producto_id')::uuid      as producto_id,
             sum((value ->> 'cantidad')::integer) as cantidad
      from jsonb_array_elements(v_demanda)
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

    select d.disponible, pr.nombre into v_disponible, v_nombre
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
  end loop;

  -- ── precios de las cookies sueltas ──────────────────────────────────────
  for v_item in
    select jsonb_build_object('producto_id', t.producto_id, 'cantidad', t.cantidad)
    from (
      select (value ->> 'producto_id')::uuid      as producto_id,
             sum((value ->> 'cantidad')::integer) as cantidad
      from jsonb_array_elements(v_items)
      group by 1
    ) t
  loop
    v_producto_id := (v_item ->> 'producto_id')::uuid;
    v_cantidad    := (v_item ->> 'cantidad')::integer;

    -- El precio sale de horneada_stock, jamás del payload.
    select hs.precio, pr.nombre into v_precio, v_nombre
    from public.horneada_stock hs
    join public.productos pr on pr.id = hs.producto_id
    where hs.horneada_id = v_horneada.id and hs.producto_id = v_producto_id;

    v_subtotal := v_subtotal + v_precio * v_cantidad;
    v_lineas := v_lineas || jsonb_build_object(
      'producto_id', v_producto_id,
      'nombre',      v_nombre,
      'precio',      v_precio,
      'cantidad',    v_cantidad
    );
  end loop;

  -- Retirar por el hub no cuesta nada; el envío gratis por monto sólo aplica
  -- a los que sí piden envío.
  v_envio := case
    when v_entrega = 'take_away'                       then 0
    when v_subtotal >= v_horneada.envio_gratis_desde   then 0
    else v_zona.envio
  end;

  insert into public.pedidos (
    horneada_id, horneada_dia_id, zona_id, franja_idx,
    cliente_nombre, cliente_telefono, direccion, nota, entrega,
    subtotal, envio, total
  ) values (
    v_horneada.id, v_dia.id, v_zona.id, v_franja_idx,
    v_nombre_cliente, v_telefono, v_direccion,
    btrim(coalesce(payload ->> 'nota', '')), v_entrega,
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

  -- ── las cajas, con su contenido ─────────────────────────────────────────
  for v_combo in select * from jsonb_array_elements(v_combos) loop
    v_combo_cant := coalesce((v_combo ->> 'cantidad')::integer, 1);

    select c.id, c.nombre, hc.precio
      into v_combo_id, v_combo_nombre, v_combo_precio
    from public.combos c
    join public.horneada_combos hc
      on hc.combo_id = c.id and hc.horneada_id = v_horneada.id
    where c.id = (v_combo ->> 'combo_id')::uuid;

    insert into public.pedido_combos (pedido_id, combo_id, nombre, precio, cantidad)
    values (v_pedido_id, v_combo_id, v_combo_nombre, v_combo_precio, v_combo_cant)
    returning id into v_pedido_combo;

    -- precio_unitario 0: la caja ya las pagó.
    insert into public.pedido_items
      (pedido_id, pedido_combo_id, producto_id, nombre, precio_unitario, cantidad)
    select v_pedido_id, v_pedido_combo, pr.id, pr.nombre, 0, t.cantidad
    from (
      select (e ->> 'producto_id')::uuid      as producto_id,
             sum((e ->> 'cantidad')::integer) as cantidad
      from jsonb_array_elements(coalesce(v_combo -> 'elecciones', '[]'::jsonb)) e
      group by 1
    ) t
    join public.productos pr on pr.id = t.producto_id;

    v_detalle_combos := v_detalle_combos || jsonb_build_object(
      'nombre',   v_combo_nombre,
      'cantidad', v_combo_cant,
      'total',    v_combo_precio * v_combo_cant,
      'detalle',  (
        select coalesce(string_agg(pr.nombre || ' ×' || t.cantidad, ', ' order by pr.nombre), '')
        from (
          select (e ->> 'producto_id')::uuid      as producto_id,
                 sum((e ->> 'cantidad')::integer) as cantidad
          from jsonb_array_elements(coalesce(v_combo -> 'elecciones', '[]'::jsonb)) e
          group by 1
        ) t
        join public.productos pr on pr.id = t.producto_id
      )
    );
  end loop;

  return jsonb_build_object(
    'pedido_id', v_pedido_id,
    'codigo',    v_codigo,
    'subtotal',  v_subtotal,
    'envio',     v_envio,
    'total',     v_subtotal + v_envio,
    'entrega',   v_entrega,
    'zona',      v_zona.nombre,
    'hub',       v_zona.hub,
    'fecha',     v_dia.fecha,
    'combos',    v_detalle_combos,
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
