insert into organizations(name) values ('Nova Electronics');
with o as (select id from organizations where name='Nova Electronics' order by created_at desc limit 1)
insert into products(organization_id,name,category)
select id,'NovaPhone X','Smartphone' from o union all
select id,'NovaBuds Pro','Audio' from o union all
select id,'NovaWatch','Wearable' from o;
