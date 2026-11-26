-- The transition from the previous New Lead dropdown to the shared catalog
-- did not copy the built-in choices. Backfill only never-configured catalogs.
insert into public.crm_practice_areas (firm_id, name, sort_order)
select f.id, defaults.name, defaults.sort_order
from public.crm_firms f
cross join (values
  ('CIVIL GENERAL', 10),
  ('SUCESIONES Y HERENCIAS', 20),
  ('ARRENDAMIENTOS', 30),
  ('DESAHUCIOS', 40),
  ('COMPRAVENTAS E INMUEBLES', 50),
  ('DIVISIÓN DE COSA COMÚN', 60),
  ('RECLAMACIÓN DE CANTIDAD', 70),
  ('PROPIEDAD HORIZONTAL', 80),
  ('CONTRATOS E INCUMPLIMIENTOS', 90),
  ('FAMILIA Y DIVORCIOS', 100),
  ('LIQUIDACIÓN DE GANANCIALES', 110),
  ('RESPONSABILIDAD CIVIL Y DAÑOS', 120),
  ('DERECHO BANCARIO', 130),
  ('EJECUCIONES', 140),
  ('VALORACIÓN Y PERITAJES', 150)
) as defaults(name, sort_order)
where not exists (
  select 1 from public.crm_practice_areas existing where existing.firm_id = f.id
)
on conflict do nothing;
