-- Satış/iade kaydına, hangi kongre/workshop'ta yapıldığını serbest metin
-- olarak not düşebilmek için (kullanıcı isteği, 2026-08-27: "satışlarda
-- doktorun yanında hangi kongre yada hangi workshop olduğunun ismi
-- girilebilmeli"). Kongreler modülündeki resmî kayıtlara bağlı bir foreign
-- key DEĞİL — her satış mutlaka izlenen bir kongreyle ilişkili olmayabilir,
-- serbest metin daha esnek.
alter table public.sales add column if not exists congress_name text;
