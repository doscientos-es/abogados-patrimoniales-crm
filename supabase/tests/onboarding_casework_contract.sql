-- Run after 20261013150000_open_case_on_payment_or_authorized_exception.sql.
do $$
declare
  body text;
begin
  select pg_get_functiondef(
    'public.crm_open_onboarding_case(uuid,integer,text,text,text,text,public.crm_priority,uuid,text,text)'::regprocedure
  ) into body;

  if body not ilike '%current_record.payment_confirmed_on is null%' then
    raise exception 'Case opening must distinguish paid and unpaid onboarding';
  end if;
  if body not ilike '%Inicio sin provisión autorizado:%' then
    raise exception 'Opening without payment must require an auditable reason';
  end if;
  if body not ilike '%m.role in (''owner'', ''admin'', ''lawyer'')%' then
    raise exception 'Opening without payment must require an authorized firm role';
  end if;
  if body not ilike '%participants_transferred%' or body not ilike '%commercialIntake%' then
    raise exception 'The case must retain the commercial intake and transferred participants';
  end if;
  if body not ilike '%c.firm_id = current_record.firm_id%' then
    raise exception 'Transferred contact references must be constrained to the source firm';
  end if;
end;
$$;