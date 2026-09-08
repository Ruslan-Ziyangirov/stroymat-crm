-- =====================================================================
-- Демо-данные для CRM «СТРОЙМАТ»
-- Запускать ПОСЛЕ 0001_init.sql
-- =====================================================================

-- Магазины ------------------------------------------------------------
insert into public.stores (name, code, city) values
  ('СТРОЙМАТ Сыктывкар',  'ST-01', 'Сыктывкар'),
  ('СТРОЙМАТ Помоздино',  'ST-02', 'Помоздино'),
  ('СТРОЙМАТ Усть-Кулом', 'ST-03', 'Усть-Кулом'),
  ('СТРОЙМАТ Корткерос',  'ST-04', 'Корткерос')
on conflict (code) do nothing;

-- Номенклатура --------------------------------------------------------
insert into public.products (sku, name, category, unit, price) values
  ('CEM-500', 'Цемент М500, 50 кг',                 'Сухие смеси',    'меш', 620),
  ('CEM-400', 'Цемент М400, 50 кг',                 'Сухие смеси',    'меш', 540),
  ('BRK-RED', 'Кирпич керамический рядовой',        'Кирпич и блоки', 'шт',  22),
  ('BLK-GAZ', 'Газоблок 600х300х200',               'Кирпич и блоки', 'шт',  145),
  ('PLW-12',  'Фанера ФК 12 мм, 1525х1525',         'Пиломатериалы',  'лист',1290),
  ('BRD-50',  'Доска обрезная 50х150х6000',         'Пиломатериалы',  'м3',  14800),
  ('GKL-12',  'Гипсокартон 12.5 мм, 2500х1200',     'Отделка',        'лист',480),
  ('INS-100', 'Утеплитель минвата 100 мм, 6 м2',    'Изоляция',       'уп',  1350),
  ('PRF-60',  'Профиль потолочный 60х27, 3 м',      'Отделка',        'шт',  195),
  ('SND-25',  'Песок строительный, 25 кг',          'Сыпучие',        'меш', 110),
  ('GRV-25',  'Щебень фр. 20-40, 25 кг',            'Сыпучие',        'меш', 135),
  ('PNT-10',  'Краска фасадная белая, 10 л',        'ЛКМ',            'шт',  2450)
on conflict (sku) do nothing;

-- Клиенты -------------------------------------------------------------
insert into public.clients (name, type, status, inn, phone, email, address, source, store_id, discount_percent)
select v.name, v.type::client_type, v.status::client_status, v.inn, v.phone, v.email, v.address, v.source,
       (select id from public.stores order by code limit 1), v.discount
from (values
  ('ООО «СтройДом»',            'company',    'active',   '7701234567', '+7 495 111-11-11', 'info@stroydom.ru',  'Москва, ул. Ленина, 1',    'Сайт',        3.0),
  ('ИП Ковалёв А.С.',           'company',    'active',   '7702345678', '+7 495 222-22-22', 'kovalev@mail.ru',   'Москва, ул. Мира, 8',      'Рекомендация',2.0),
  ('ООО «РемонтПро»',           'company',    'active',   '7703456789', '+7 495 333-33-33', 'zakaz@remontpro.ru','Москва, Кутузовский, 22',  'Холодный звонок', 5.0),
  ('Петров Иван Сергеевич',     'individual', 'active',   null,         '+7 916 444-44-44', 'petrov@ya.ru',      'Москва, Химки',            'Витрина',     0.0),
  ('ООО «ГрандСтрой»',          'company',    'lead',     '7704567890', '+7 495 555-55-55', 'office@grand.ru',   'Подольск, Кирова, 12',     'Выставка',    0.0),
  ('Сидорова Мария Павловна',   'individual', 'active',   null,         '+7 903 666-66-66', 'sidorova@gmail.com','Москва, Северный',         'Сайт',        0.0),
  ('ООО «АльфаМонтаж»',         'company',    'active',   '7705678901', '+7 495 777-77-77', 'alfa@montazh.ru',   'Москва, Варшавское ш., 3', 'Сайт',        4.0),
  ('ИП Николаев Д.В.',          'company',    'inactive', '7706789012', '+7 495 888-88-88', 'nikolaev@bk.ru',    'Подольск, Садовая, 7',     'Рекомендация',0.0)
) as v(name, type, status, inn, phone, email, address, source, discount)
where not exists (select 1 from public.clients c where c.name = v.name);

-- Заказы за последние 8 месяцев ---------------------------------------
do $$
declare
  m int;
  i int;
  v_client uuid;
  v_store uuid;
  v_order uuid;
  v_created timestamptz;
  v_status order_status;
  v_product record;
  v_cnt int;
begin
  if (select count(*) from public.orders) > 0 then
    return;
  end if;

  for m in reverse 7..0 loop
    for i in 1..(12 + (m * 2) % 9) loop
      select id into v_client from public.clients order by random() limit 1;
      select id into v_store  from public.stores  order by random() limit 1;

      v_created := date_trunc('month', now()) - (m || ' months')::interval
                   + ((random() * 26)::int || ' days')::interval
                   + ((random() * 10)::int || ' hours')::interval;

      v_status := (array['completed','completed','completed','paid','shipping','new','cancelled'])[1 + floor(random() * 7)::int]::order_status;

      insert into public.orders (client_id, store_id, status, created_at, updated_at, comment)
      values (v_client, v_store, 'new', v_created, v_created, null)
      returning id into v_order;

      v_cnt := 1 + floor(random() * 4)::int;
      for v_product in (select * from public.products order by random() limit v_cnt) loop
        insert into public.order_items (order_id, product_id, name, unit, quantity, price)
        values (v_order, v_product.id, v_product.name, v_product.unit,
                round((1 + random() * 40)::numeric, 0), v_product.price);
      end loop;

      update public.orders set status = v_status, created_at = v_created, updated_at = v_created where id = v_order;
    end loop;
  end loop;
end $$;

-- Заметки в истории клиентов ------------------------------------------
insert into public.client_events (client_id, type, title, description, created_at)
select c.id, 'call', 'Первичный звонок', 'Уточнили потребность в материалах на объект.', now() - interval '20 days'
from public.clients c
where not exists (select 1 from public.client_events e where e.client_id = c.id and e.type = 'call');
