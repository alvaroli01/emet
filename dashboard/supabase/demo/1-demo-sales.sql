-- emet class demo: ~€2,000 of example sales over the last 7 days + 2 small expenses. All tagged [DEMO].
insert into sales (date, description, amount, cost, channel, heard_about, payment_method, quantity)
select current_date - (g % 7), '[DEMO] ' || (array['Tote bag','Hoodie','Sticker pack','Cap','T-shirt','Tote bag x2'])[1 + g % 6],
       (array[25,45,8,20,30,50])[1 + g % 6] + (g % 3) * 5, round(((array[25,45,8,20,30,50])[1 + g % 6]) * 0.42, 2),
       (array['stall','instagram','stall','tiktok','whatsapp','stall'])[1 + g % 6],
       (array['stall','instagram','friend','tiktok','whatsapp','poster'])[1 + g % 6],
       (array['cash','bizum','card','bizum','transfer','cash'])[1 + g % 6], case when g % 6 = 5 then 2 else 1 end
from generate_series(0, 49) g where g < 24 or g % 5 = 0;
insert into expenses (date, description, category, amount, payment_method)
values (current_date - 5, '[DEMO] Stall table rental', 'stall', 40, 'cash'), (current_date - 2, '[DEMO] Printing flyers', 'marketing', 35, 'card');
