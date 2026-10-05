-- Corrections of the imported stock, from the leadership (2026-10-05): the sheet gave the
-- bus and the first boat the same in-game id; the boats have new plates.

update public.fleet_vehicles set game_id = 255533 where plate = 'SFSD-300';
update public.fleet_vehicles set plate = 'RZB-060', game_id = 319703 where plate = 'CZT-170';
update public.fleet_vehicles set plate = 'AOG-093', game_id = 319704 where plate = 'ECO-042';
