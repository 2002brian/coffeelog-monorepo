create or replace function public.deduct_bean_inventory(
  p_bean_id uuid,
  p_amount numeric
)
returns public.beans
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_bean public.beans;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'p_amount must be greater than 0';
  end if;

  update public.beans
  set
    "remainingWeight" = greatest(coalesce("remainingWeight", 0) - p_amount, 0),
    status = case
      when coalesce("remainingWeight", 0) - p_amount <= 0 then 'ARCHIVED'
      when status = 'RESTING' then 'ACTIVE'
      else status
    end
  where id = p_bean_id
  returning * into updated_bean;

  if updated_bean is null then
    raise exception 'Bean % not found', p_bean_id;
  end if;

  return updated_bean;
end;
$$;
