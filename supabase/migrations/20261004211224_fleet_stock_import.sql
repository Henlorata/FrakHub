-- The department's vehicle stock and tuning presets, taken over from the old "Car Database"
-- sheets (#1 Kiosztások, #3 Tuning). Plates, models, in-game ids, stations and registration
-- dates only: the key holders are imported separately (they need the production profiles).
--
-- Idempotent: an existing plate (registered earlier from an approved request) is updated
-- with the stock data.

insert into public.fleet_vehicles (plate, model, category_id, game_id, station, registration_expires_on, capacity,
                                   shared_label, allowed_units, min_rank, is_unmarked, registration_required, callsign, notes)
select v.plate, v.model, v.category_id, v.game_id, v.station, v.expires_on::date, v.capacity::smallint,
       v.shared_label, v.allowed_units::text[], v.min_rank, v.is_unmarked, v.registration_required, v.callsign, v.notes
from (values
  -- Marked Dodge Durango '14
  ('SFSD-001', 'Dodge Durango ''14', 'durango', 188987, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-002', 'Dodge Durango ''14', 'durango', 188753, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-003', 'Dodge Durango ''14', 'durango', 188986, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-004', 'Dodge Durango ''14', 'durango', 190312, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-005', 'Dodge Durango ''14', 'durango', 190315, 'Angel Pine', null, 2, null, null, null, false, true, null, null),
  ('SFSD-006', 'Dodge Durango ''14', 'durango', 190316, 'Angel Pine', '2026-10-25', 2, null, null, null, true, true, null, null),
  ('SFSD-007', 'Dodge Durango ''14', 'durango', 190317, 'Fort Carson', '2026-11-12', 2, null, null, null, false, true, null, null),
  ('SFSD-008', 'Dodge Durango ''14', 'durango', 190324, 'Fort Carson', '2026-07-11', 2, null, null, null, false, true, null, null),
  -- Marked Ford Explorer
  ('SFSD-009', 'Ford Explorer', 'explorer', 190328, 'Downtown', '2026-09-23', 2, null, null, null, false, true, null, null),
  ('SFSD-010', 'Ford Explorer', 'explorer', 250566, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-011', 'Ford Explorer', 'explorer', 250561, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-012', 'Ford Explorer', 'explorer', 250562, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-013', 'Ford Explorer', 'explorer', 250563, 'Downtown', '2026-10-25', 2, null, null, null, false, true, null, null),
  ('SFSD-014', 'Ford Explorer', 'explorer', 250564, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-015', 'Ford Explorer', 'explorer', 250565, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-016', 'Ford Explorer', 'explorer', 250569, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-017', 'Ford Explorer', 'explorer', 250568, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-018', 'Ford Explorer', 'explorer', 250567, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-019', 'Ford Explorer', 'explorer', 190338, 'Downtown', '2026-10-28', 2, null, null, null, false, true, null, null),
  ('SFSD-020', 'Ford Explorer', 'explorer', 190331, 'Downtown', '2026-10-18', 2, null, null, null, false, true, null, null),
  ('SFSD-021', 'Ford Explorer', 'explorer', 190332, 'Downtown', '2026-09-07', 2, null, null, null, false, true, null, null),
  ('SFSD-022', 'Ford Explorer', 'explorer', 190334, 'Angel Pine', '2026-09-14', 2, null, null, null, false, true, null, null),
  ('SFSD-023', 'Ford Explorer', 'explorer', 190335, 'Angel Pine', null, 2, null, null, null, false, true, null, null),
  ('SFSD-024', 'Ford Explorer', 'explorer', 188993, 'Angel Pine', null, 2, null, null, null, false, true, null, null),
  ('SFSD-025', 'Ford Explorer', 'explorer', 188992, 'Fort Carson', '2025-11-30', 2, null, null, null, false, true, null, null),
  ('SFSD-026', 'Ford Explorer', 'explorer', 188990, 'Fort Carson', '2026-10-02', 2, null, null, null, false, true, null, null),
  ('SFSD-027', 'Ford Explorer', 'explorer', 188991, 'Fort Carson', '2026-11-03', 2, null, null, null, false, true, null, null),
  ('SFSD-028', 'Ford Explorer', 'explorer', 190341, 'Fort Carson', '2026-04-07', 2, null, null, null, false, true, null, null),
  -- Marked Dodge Charger SRT
  ('SFSD-029', 'Dodge Charger SRT 2015', 'charger', 198321, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-030', 'Dodge Charger SRT 2015', 'charger', 195138, 'Downtown', '2026-01-13', 2, null, null, null, false, true, null, null),
  ('SFSD-031', 'Dodge Charger SRT 2015', 'charger', 199260, 'Downtown', '2026-10-19', 2, null, null, null, false, true, null, null),
  ('SFSD-032', 'Dodge Charger SRT 2015', 'charger', 212458, 'Downtown', '2026-02-10', 2, null, null, null, false, true, null, null),
  ('SFSD-033', 'Dodge Charger SRT 2015', 'charger', 212457, 'Downtown', '2025-05-17', 2, null, null, null, false, true, null, null),
  ('SFSD-034', 'Dodge Charger SRT 2015', 'charger', 190343, 'Downtown', '2026-10-25', 2, null, null, null, false, true, null, null),
  ('SFSD-035', 'Dodge Charger SRT 2015', 'charger', 190344, 'Angel Pine', '2026-10-25', 2, null, null, null, false, true, null, null),
  ('SFSD-036', 'Dodge Charger SRT 2015', 'charger', 188977, 'Angel Pine', '2026-09-05', 2, null, null, null, false, true, null, null),
  ('SFSD-037', 'Dodge Charger SRT 2015', 'charger', 188979, 'Fort Carson', null, 2, null, null, null, false, true, null, null),
  ('SFSD-038', 'Dodge Charger SRT 2015', 'charger', 188976, 'Fort Carson', null, 2, null, null, null, false, true, null, null),
  ('SFSD-039', 'Dodge Charger SRT 2015', 'charger', 190337, 'Fort Carson', null, 2, null, null, null, false, true, null, null),
  ('SFSD-040', 'Dodge Charger SRT 2015', 'charger', 188983, 'Fort Carson', null, 2, null, null, null, false, true, null, null),
  ('SFSD-041', 'Dodge Charger SRT 2015', 'charger', 228935, 'Fort Carson', null, 2, null, null, null, false, true, null, null),
  -- Marked Ford Crown Victoria
  ('SFSD-042', 'Ford Crown Victoria', 'crown-victoria', 188982, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-043', 'Ford Crown Victoria', 'crown-victoria', 239699, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-044', 'Ford Crown Victoria', 'crown-victoria', 239698, 'Downtown', '2025-05-06', 2, null, null, null, true, true, null, null),
  ('SFSD-045', 'Ford Crown Victoria', 'crown-victoria', 190336, 'Angel Pine', null, 2, null, null, null, false, true, null, null),
  ('SFSD-046', 'Ford Crown Victoria', 'crown-victoria', 198326, 'Angel Pine', '2026-10-31', 2, null, null, null, false, true, null, null),
  ('SFSD-047', 'Ford Crown Victoria', 'crown-victoria', 195132, 'Fort Carson', null, 2, null, null, null, false, true, null, null),
  ('SFSD-048', 'Ford Crown Victoria', 'crown-victoria', 195133, 'Fort Carson', null, 2, null, null, null, false, true, null, null),
  -- Game Warden
  ('SFSD-049', 'Chevrolet Silverado', 'game-warden', 290683, 'Fort Carson', null, 2, null, null, null, false, true, null, null),
  ('SFSD-050', 'Chevrolet Silverado', 'game-warden', 290684, 'Fort Carson', null, 2, null, null, null, false, true, null, null),
  ('SFSD-051', 'Chevrolet Silverado', 'game-warden', 290685, 'Fort Carson', null, 2, null, null, null, false, true, null, null),
  -- Marked Chevrolet Tahoe
  ('SFSD-052', 'Chevrolet Tahoe', 'tahoe', 307588, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-053', 'Chevrolet Tahoe', 'tahoe', 307591, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-054', 'Chevrolet Tahoe', 'tahoe', 307587, 'Downtown', '2026-09-27', 2, null, null, null, false, true, null, null),
  ('SFSD-055', 'Chevrolet Tahoe', 'tahoe', 307586, 'Downtown', '2026-10-25', 2, null, null, null, false, true, null, null),
  ('SFSD-056', 'Chevrolet Tahoe', 'tahoe', 307592, 'Downtown', '2026-10-20', 2, null, null, null, false, true, null, null),
  ('SFSD-057', 'Chevrolet Tahoe', 'tahoe', 307584, 'Downtown', '2026-11-08', 2, null, null, null, false, true, null, null),
  ('SFSD-058', 'Chevrolet Tahoe', 'tahoe', 307593, 'Angel Pine', '2026-05-25', 2, null, null, null, false, true, null, null),
  ('SFSD-059', 'Chevrolet Tahoe', 'tahoe', 307585, 'Angel Pine', '2026-05-27', 2, null, null, null, false, true, null, null),
  ('SFSD-060', 'Chevrolet Tahoe', 'tahoe', 307581, 'Fort Carson', '2026-07-29', 2, null, null, null, false, true, null, null),
  ('SFSD-061', 'Chevrolet Tahoe', 'tahoe', 307582, 'Fort Carson', '2026-09-22', 2, null, null, null, false, true, null, null),
  ('SFSD-062', 'Chevrolet Tahoe', 'tahoe', 307594, 'Fort Carson', null, 2, null, null, null, false, true, null, null),
  -- Marked GMC Yukon (Supervisory)
  ('SFSD-063', 'GMC Yukon', 'yukon', 311823, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-064', 'GMC Yukon', 'yukon', 311824, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-065', 'GMC Yukon', 'yukon', 311825, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-066', 'GMC Yukon', 'yukon', 311826, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-067', 'GMC Yukon', 'yukon', 311827, 'Downtown', null, 2, null, null, null, false, true, null, null),
  -- Slicktop (Command & Executive)
  ('SFSD-100', 'Slicktop Ford Explorer', 'slicktop', 259805, 'Downtown', '2026-10-25', 2, null, null, null, false, true, null, null),
  ('SFSD-101', 'Slicktop Ford Explorer', 'slicktop', 221871, 'Downtown', '2026-10-25', 2, null, null, null, false, true, null, null),
  ('SFSD-102', 'Cadillac Escalade', 'slicktop', 255770, 'Downtown', null, 0, 'Executive Staff', null, 'Deputy Commander', false, true, null, null),
  ('SFSD-103', 'Chevrolet Tahoe', 'slicktop', 307590, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-104', 'Chevrolet Tahoe', 'slicktop', 307589, 'Downtown', '2026-09-16', 2, null, null, null, false, true, null, null),
  -- Special Enforcement Bureau
  ('SEB-001', 'Ford Explorer', 'seb', 228936, 'Hubert', '2026-10-23', 2, null, null, null, false, true, null, null),
  ('SEB-002', 'Ford Explorer', 'seb', 199237, 'Hubert', '2026-10-23', 2, null, null, null, false, true, null, null),
  ('SEB-003', 'Chevrolet Tahoe Unmarked', 'seb', 198320, 'Hubert', '2026-10-23', 2, null, null, null, true, true, null, null),
  ('SEB-004', 'Chevrolet Tahoe Unmarked', 'seb', 199241, 'Hubert', '2026-10-23', 2, null, null, null, true, true, null, null),
  ('SEB-005', 'Dodge Charger SRT 2015', 'seb', 228924, 'Hubert', '2026-10-23', 1, 'SEB Operator III.', null, null, false, true, null,
   'Az 1. kulcs az Operator III. rangú SEB tagoké.'),
  ('SEB-006', 'Dodge Charger SRT 2015', 'seb', 253328, 'Hubert', '2026-10-23', 1, 'Bureau Commander / Manager', null, null, false, true, null,
   'Az 1. kulcs a Bureau Commander / Manager járműve.'),
  ('SEB-007', 'Ford Explorer-Unmarked', 'seb', 253329, 'Hubert', '2026-10-23', 2, null, null, null, true, true, null, null),
  ('SEB-008', 'Ford Explorer-Unmarked', 'seb', 216957, 'Hubert', '2026-10-23', 2, null, null, null, true, true, null, null),
  ('SEB-009', 'Alpenwerk VX5-40', 'seb', 277063, 'Hubert', '2026-10-23', 2, null, null, null, false, true, null, null),
  ('SEB-010', 'Alpenwerk VX5-40', 'seb', 198327, 'Hubert', '2026-10-23', 2, null, null, null, false, true, null, null),
  ('SEB-011', 'Chevrolet Tahoe', 'seb', 307596, 'Hubert', '2026-10-23', 2, null, null, null, false, true, null, null),
  ('SEB-012', 'Chevrolet Tahoe', 'seb', 307595, 'Hubert', '2026-10-23', 2, null, null, null, false, true, null, null),
  ('MFS-288', 'Chevrolet Tahoe', 'seb', 308059, 'Hubert', '2026-10-23', 2, null, null, null, false, true, null, null),
  ('MEM-558', 'Chevrolet Tahoe Unmarked', 'seb', 308173, 'Hubert', '2026-10-23', 2, null, null, null, true, true, null, null),
  ('RESCUE-1', 'Lenco Bearcat', 'seb', 230922, 'Hubert', '2026-10-23', 0, 'SEB Staff', null, null, false, true, null, null),
  ('RESCUE-2', 'Lenco Bearcat', 'seb', 230923, 'Hubert', '2026-10-23', 0, 'SEB Staff', null, null, false, true, null, null),
  ('RESCUE-3', 'Lenco Bearcat-Bridge', 'seb', 230920, 'Hubert', '2026-10-23', 0, 'SEB Staff', null, null, false, true, null, null),
  ('RESCUE-4', 'Lenco Bearcat-Bridge', 'seb', 230919, 'Hubert', '2026-10-23', 0, 'SEB Staff', null, null, false, true, null, null),
  -- Aero Bureau (helicopters: the call sign is not the plate)
  ('SZR-812', 'Police Maverick', 'ab', 306616, 'Downtown', null, 2, null, null, null, false, true, 'AIR-001', null),
  ('NFO-348', 'Police Maverick', 'ab', 306617, 'Downtown', null, 3, null, '{AB,SEB}', null, false, true, 'AIR-002',
   'A 2. kulcson Dalton Saunders és Metie Vipie osztozik.'),
  ('SRG-517', 'Police Maverick', 'ab', 297891, 'Hubert', null, 2, null, '{AB,SEB}', null, false, true, 'AIR-003',
   'A 2. kulcs SEB tag számára fenntartva.'),
  ('AIR-004', 'Boeing Vertol CH-46 Sea Knight', 'ab', 306252, 'Hubert', null, 2, null, '{AB,SEB}', null, false, true, null,
   'A 2. kulcs SEB tag számára fenntartva.'),
  -- Medical Unit (shared ambulances)
  ('MEDIC-01', 'Lenco Bearcat - Paramedic', 'mu', 230921, 'Downtown', '2026-09-16', 0, 'Medical Unit', null, null, false, true, null, null),
  ('MEDIC-02', 'Ford Explorer - Paramedic', 'mu', 264806, 'Hubert', null, 0, 'Medical Unit', null, null, false, true, null, null),
  ('MEDIC-03', 'Lenco Bearcat - Paramedic', 'mu', 250585, 'Hubert', null, 0, 'Medical Unit', null, null, false, true, null, null),
  ('MEDIC-04', 'Mercedes Sprinter - Paramedic', 'mu', 264807, 'Downtown', null, 0, 'Medical Unit', null, null, false, true, null, null),
  ('MEDIC-05', 'Mercedes Sprinter - Paramedic', 'mu', 255772, 'Hubert', '2026-10-23', 0, 'Medical Unit', null, null, false, true, null, null),
  ('MEDIC-06', 'Mercedes Sprinter - Paramedic', 'mu', 199259, 'Fort Carson', null, 0, 'Medical Unit', null, null, false, true, null, null),
  -- San Andreas Highway Patrol Unit
  ('SFSD-200', 'Dodge Demon SRT', 'sahp', 255765, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-201', 'Dodge Demon SRT', 'sahp', 255766, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-202', 'Dodge Demon SRT', 'sahp', 255767, 'Downtown', null, 2, null, null, null, false, true, null, null),
  ('SFSD-203', 'Chevrolet Corvette', 'sahp', 245868, 'Downtown', null, 1, 'Executive Staff', '{}', 'Deputy Commander', false, true, null, null),
  ('SFSD-205', 'Dodge Demon SRT', 'sahp', 259914, 'Downtown', '2026-07-25', 2, null, null, null, false, true, null, null),
  ('SFSD-206', 'Dodge Demon SRT', 'sahp', 259917, 'Downtown', '2026-11-03', 2, null, null, null, false, true, null, null),
  ('SFSD-207', 'Dodge Demon SRT', 'sahp', 259915, 'Downtown', '2026-04-01', 2, null, null, null, false, true, null, null),
  -- Major Crimes Bureau (civilian vehicles)
  ('OXP-579', 'Alpenwerk X6', 'mcb', 200647, 'Angel Pine', null, 2, null, '{MCB,FAB}', null, false, true, null, 'FAB használatra is.'),
  ('PJA-404', 'Subaru Impreza WRX', 'mcb', 245869, 'Angel Pine', null, 2, null, null, null, false, true, null, null),
  ('CKI-683', 'Cadillac Escalade', 'mcb', 195128, 'Angel Pine', null, 2, null, null, null, false, true, null, null),
  ('HPY-263', 'Mitsubishi Evo', 'mcb', 195140, 'Angel Pine', null, 2, null, null, null, false, true, null, null),
  ('UYS-716', 'Audi RS5', 'mcb', 280818, 'Angel Pine', null, 2, null, null, null, false, true, null, null),
  ('FPW-645', 'Alpenwerk VX5-40', 'mcb', 249230, 'Angel Pine', null, 2, null, null, null, false, true, null, null),
  ('FGH-443', 'Mercedes Benz G63 AMG', 'mcb', 245870, 'Angel Pine', null, 2, null, null, null, false, true, null, null),
  ('HCG-233', 'Audi RS6', 'mcb', 246190, 'Angel Pine', null, 2, null, null, null, false, true, null, null),
  ('OKI-226', 'Ford Mustang', 'mcb', 195124, 'Angel Pine', '2026-10-26', 2, null, null, null, false, true, null, null),
  ('HYT-882', 'Range Rover', 'mcb', 245867, 'Angel Pine', null, 2, null, null, null, false, true, null, null),
  ('ICT-197', 'Mercedes-Benz GLS', 'mcb', 245866, 'Angel Pine', null, 2, null, null, null, false, true, null, null),
  -- Diplomat (one key each)
  ('GFN-038', 'Alpenwerk R5S Alpenmeister ''22', 'diplomat', 303583, 'Downtown', null, 1, null, null, null, false, true, null, null),
  ('NTN-268', 'Alpenwerk R5S Alpenmeister ''22', 'diplomat', 303584, 'Downtown', null, 1, null, null, null, false, true, null, null),
  -- Other: buses, tow truck, trucks and boats (null capacity: any number of keys)
  ('SFSD-300', 'Busz', 'other', 198325, 'Downtown', '2026-10-25', 0, 'Supervisory / Command Staff', null, 'Sergeant I.', false, true, null, null),
  ('SFSD-301', 'Ford F-150 Vontató', 'other', 190348, 'Hubert', null, null, null, null, null, false, true, null, null),
  ('SFSD-302', 'Mercedes Arocs', 'other', 234904, 'Downtown', '2026-10-25', null, null, null, null, false, true, null, null),
  ('SFSD-303', 'Mercedes Arocs', 'other', 256522, 'Fort Carson', null, null, null, null, null, false, true, null, null),
  ('SFSD-304', 'Mercedes-Benz Vito', 'other', 277039, 'Hubert', '2026-10-23', 0, 'Supervisory / Command Staff', null, 'Sergeant I.', false, true, null, null),
  ('SFSD-305', 'Mercedes-Benz Vito', 'other', 277077, 'Angel Pine', '2026-10-23', 0, 'Supervisory / Command Staff', null, 'Sergeant I.', false, true, null, null),
  ('CZT-170', 'Predator', 'other', 198325, 'Downtown', null, null, null, null, null, false, false, null, null),
  ('ECO-042', 'Predator', 'other', 198324, 'Downtown', null, null, null, null, null, false, false, null, null),
  ('EPU-376', 'Mercedes Sprinter', 'other', 195130, 'Downtown', null, 2, null, null, null, false, true, null, null)
) as v(plate, model, category_id, game_id, station, expires_on, capacity, shared_label, allowed_units, min_rank, is_unmarked,
       registration_required, callsign, notes)
on conflict ((upper(btrim(plate)))) do update
  set model = excluded.model, category_id = excluded.category_id, game_id = excluded.game_id, station = excluded.station,
      registration_expires_on = coalesce(excluded.registration_expires_on, fleet_vehicles.registration_expires_on),
      capacity = excluded.capacity, shared_label = excluded.shared_label, allowed_units = excluded.allowed_units,
      min_rank = excluded.min_rank, is_unmarked = excluded.is_unmarked, registration_required = excluded.registration_required,
      callsign = excluded.callsign, notes = excluded.notes, is_active = true;

insert into public.fleet_tuning_presets (model, settings, note, sort_order)
select t.model, t.settings::jsonb, t.note, t.sort_order
from (values
  ('Ford Explorer', '{"top_speed": "10", "acceleration": "10", "traction": "2", "cornering_grip": "3", "braking": "0", "spring": "0", "damping": "0", "engine_inertia": "0", "mass": "0", "cornering_mass": "0", "brake_bias": "0", "suspension_ratio": "0", "grip_bias": "0", "drag": "50%"}', null, 10),
  ('Dodge Charger', '{"top_speed": "7", "acceleration": "10", "traction": "5", "cornering_grip": "2", "braking": "0", "spring": "0", "damping": "0", "engine_inertia": "1", "mass": "0", "cornering_mass": "0", "brake_bias": "0", "suspension_ratio": "8%", "grip_bias": "-10%", "drag": "15%"}', '55-ös fordulási szög', 20),
  ('Ford Taurus', '{"top_speed": "8", "acceleration": "10", "traction": "2", "cornering_grip": "0", "braking": "0", "spring": "0", "damping": "0", "engine_inertia": "5", "mass": "0", "cornering_mass": "0", "brake_bias": "12", "suspension_ratio": "0", "grip_bias": "0", "drag": "0"}', null, 30),
  ('Ford Crown Victoria', '{"top_speed": "8", "acceleration": "10", "traction": "4", "cornering_grip": "3", "braking": "0", "spring": "0", "damping": "0", "engine_inertia": "0", "mass": "0", "cornering_mass": "15%", "brake_bias": "10%", "suspension_ratio": "-7%", "grip_bias": "-5%", "drag": "100%"}', null, 40),
  ('Dodge Challenger SRT Police', '{"top_speed": "7", "acceleration": "10", "traction": "7", "cornering_grip": "6", "braking": "0", "spring": "0", "damping": "0", "engine_inertia": "0", "mass": "0", "cornering_mass": "8", "brake_bias": "-10", "suspension_ratio": "0", "grip_bias": "0", "drag": "-25"}', null, 50),
  ('Ford Raptor', '{"top_speed": "10", "acceleration": "10", "traction": "2", "cornering_grip": "2", "braking": "0", "spring": "0", "damping": "0", "engine_inertia": "1", "mass": "0", "cornering_mass": "0", "brake_bias": "0", "suspension_ratio": "0", "grip_bias": "0", "drag": "-25"}', null, 60)
) as t(model, settings, note, sort_order)
on conflict ((lower(btrim(model)))) do nothing;
