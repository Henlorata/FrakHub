-- Baseline of the production schema (project FrakHub), captured read-only with
-- `supabase db dump` on 2026-10-04. The hosted database was built by hand, so this
-- file records its state as-is (including known advisor warnings, fixed in later
-- migrations). Do not edit; add new migrations instead.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."case_status_enum" AS ENUM (
    'open',
    'closed',
    'archived'
);


ALTER TYPE "public"."case_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."collaborator_status_enum" AS ENUM (
    'pending',
    'approved'
);


ALTER TYPE "public"."collaborator_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."request_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."request_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role_enum" AS ENUM (
    'pending',
    'detective',
    'lead_detective'
);


ALTER TYPE "public"."user_role_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_assign_exam"("_submission_id" "uuid", "_target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _app_name text;
BEGIN
  SELECT applicant_name INTO _app_name 
  FROM exam_submissions 
  WHERE id = _submission_id;

  UPDATE exam_submissions
  SET user_id = _target_user_id
  WHERE id = _submission_id 
     OR (
         user_id IS NULL 
         AND applicant_name = _app_name 
         AND _app_name IS NOT NULL 
         AND _app_name != ''
         AND start_time >= (NOW() - INTERVAL '1 month')
     );
END;
$$;


ALTER FUNCTION "public"."admin_assign_exam"("_submission_id" "uuid", "_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_user_name"("_new_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _old_name text;
BEGIN
  -- Lekérjük a régi nevet
  SELECT full_name INTO _old_name FROM profiles WHERE id = _user_id;
  
  -- Ha nem változott, kilépünk
  IF _old_name = _new_name THEN RETURN; END IF;

  -- Frissítjük a profilt
  UPDATE profiles SET full_name = _new_name WHERE id = _user_id;

  -- Naplózzuk
  INSERT INTO name_change_logs (user_id, old_name, new_name, changed_by)
  VALUES (_user_id, _old_name, _new_name, _user_id);
END;
$$;


ALTER FUNCTION "public"."change_user_name"("_new_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_exam_submission"("_token" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _sub_id uuid;
  _current_user_id uuid := auth.uid();
  _submission_record record;
BEGIN
  SELECT * INTO _submission_record 
  FROM exam_submissions 
  WHERE claim_token = _token 
  LIMIT 1;

  IF _submission_record IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Érvénytelen kód.');
  END IF;

  IF _submission_record.user_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', 'Ezt a vizsgát már hozzárendelték valakihez.');
  END IF;

  UPDATE exam_submissions
  SET user_id = _current_user_id
  WHERE id = _submission_record.id
     OR (
         user_id IS NULL 
         AND applicant_name = _submission_record.applicant_name 
         AND _submission_record.applicant_name IS NOT NULL 
         AND _submission_record.applicant_name != ''
         AND start_time >= (NOW() - INTERVAL '1 month')
     );

  RETURN json_build_object('success', true, 'message', 'Vizsga és a korábbi próbálkozások sikeresen csatolva a profilhoz!');
END;
$$;


ALTER FUNCTION "public"."claim_exam_submission"("_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clean_academy_data_on_promotion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  -- Azok a rangok, amik elérésekor TÖRÖLNI kell a Trainee adatokat.
  -- Deputy Sheriff II-től felfelé mindenki.
  clearing_ranks text[] := ARRAY[
    'Deputy Sheriff II.',
    'Deputy Sheriff III.',
    'Deputy Sheriff III+.',
    'Senior Deputy Sheriff',
    'Staff Deputy Sheriff',
    'Corporal',
    'Sergeant I.',
    'Sergeant II.',
    'Lieutenant I.',
    'Lieutenant II.',
    'Captain I.',
    'Captain II.',
    'Captain III.',
    'Deputy Commander',
    'Commander'
  ];
BEGIN
  -- Ha a rang megváltozott ÉS az új rang benne van a fenti listában
  IF OLD.faction_rank IS DISTINCT FROM NEW.faction_rank AND NEW.faction_rank = ANY(clearing_ranks) THEN
        -- Töröljük a hozzárendelést az akadémiákhoz
        DELETE FROM public.academy_students WHERE user_id = NEW.id;
        
        -- Töröljük a naplóbejegyzéseket (értékelés, jelenlét)
        DELETE FROM public.academy_logs WHERE student_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."clean_academy_data_on_promotion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_onboarding"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE profiles
  SET onboarding_completed = true
  WHERE id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."complete_onboarding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_invite_on_submission"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Töröljük a jogosultságot az adott vizsgához és felhasználóhoz
  DELETE FROM public.exam_overrides
  WHERE exam_id = NEW.exam_id AND user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."consume_invite_on_submission"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_case_securely"("_case_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_profile public.profiles%ROWTYPE;
  _case public.cases%ROWTYPE;
BEGIN
  SELECT * INTO _user_profile FROM public.profiles WHERE id = _user_id;
  SELECT * INTO _case FROM public.cases WHERE id = _case_id;

  IF _case IS NULL THEN RAISE EXCEPTION 'Az akta nem található.'; END IF;

  -- JOGOSULTSÁG: Tulajdonos, vagy MCB Vezetés (Commander/Manager)
  IF _case.owner_id != _user_id THEN
     IF NOT (_user_profile.is_bureau_manager OR (_user_profile.division = 'MCB' AND _user_profile.is_bureau_commander)) THEN
        RAISE EXCEPTION 'Csak az akta tulajdonosa vagy az osztályvezetés törölheti az aktát!';
     END IF;
  END IF;

  -- TÖRLÉS (A CASCADE miatt a bizonyítékok, gyanúsítottak, jegyzetek is törlődnek!)
  DELETE FROM cases WHERE id = _case_id;
  
  -- Értesítés (opcionális, ha nem saját magad törlöd)
  IF _case.owner_id != _user_id AND _case.owner_id IS NOT NULL THEN
     INSERT INTO notifications (user_id, title, message, type)
     VALUES (_case.owner_id, 'Akta Törölve', 'A(z) ' || _case.case_number || ' számú aktádat a vezetőség véglegesen törölte.', 'alert');
  END IF;
END;
$$;


ALTER FUNCTION "public"."delete_case_securely"("_case_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_full_exam"("_exam_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- 1. Válaszok törlése (ami ehhez a vizsgához tartozó beadásokhoz kötődik)
  DELETE FROM exam_answers 
  WHERE submission_id IN (SELECT id FROM exam_submissions WHERE exam_id = _exam_id);

  -- 2. Beadások törlése
  DELETE FROM exam_submissions WHERE exam_id = _exam_id;

  -- 3. Opciók törlése (ami ehhez a vizsgához tartozó kérdésekhez kötődik)
  DELETE FROM exam_options 
  WHERE question_id IN (SELECT id FROM exam_questions WHERE exam_id = _exam_id);

  -- 4. Kérdések törlése
  DELETE FROM exam_questions WHERE exam_id = _exam_id;

  -- 5. Kivételek (Exam Overrides) törlése
  DELETE FROM exam_overrides WHERE exam_id = _exam_id;

  -- 6. Végül maga a vizsga törlése
  DELETE FROM exams WHERE id = _exam_id;
END;
$$;


ALTER FUNCTION "public"."delete_full_exam"("_exam_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_suspect_safely"("_suspect_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_profile public.profiles%ROWTYPE;
  _suspect public.suspects%ROWTYPE;
  _active_warrants int;
  _linked_cases int;
BEGIN
  SELECT * INTO _user_profile FROM public.profiles WHERE id = _user_id;
  SELECT * INTO _suspect FROM public.suspects WHERE id = _suspect_id;

  -- 1. JOGOSULTSÁG ELLENŐRZÉS
  -- MCB Vezetés vagy Manager törölhet bárkit
  IF NOT (_user_profile.is_bureau_manager OR (_user_profile.division = 'MCB' AND _user_profile.is_bureau_commander) OR (_user_profile.division = 'MCB' AND _user_profile.division_rank = 'Investigator III.')) THEN
      -- Ha nem vezetés, akkor csak a sajátját törölheti
      IF _suspect.created_by != _user_id THEN
         RETURN json_build_object('success', false, 'message', 'Csak a saját magad által létrehozott gyanúsítottat törölheted.');
      END IF;
  END IF;

  -- 2. FÜGGŐSÉGEK ELLENŐRZÉSE
  SELECT COUNT(*) INTO _active_warrants FROM case_warrants WHERE suspect_id = _suspect_id AND status IN ('pending', 'approved');
  
  IF _active_warrants > 0 THEN
     RETURN json_build_object('success', false, 'message', 'Nem törölhető: A személyhez aktív elfogatóparancs tartozik!');
  END IF;

  -- Megnézzük, hány aktában szerepel
  SELECT COUNT(*) INTO _linked_cases FROM case_suspects WHERE suspect_id = _suspect_id;
  
  -- Ha szerepel aktákban, akkor csak "Soft Delete" (státusz váltás), vagy engedjük, de figyelmeztetjük a usert (itt most törlünk a kapcsolatokból)
  IF _linked_cases > 0 THEN
      -- A biztonság kedvéért most csak blokkoljuk, tisztább ügy
      RETURN json_build_object('success', false, 'message', 'Nem törölhető: A személy ' || _linked_cases || ' aktához van csatolva. Előbb távolítsd el az aktákból.');
  END IF;

  -- 3. TÖRLÉS
  -- Egyéb kapcsolódó táblák (járművek, ingatlanok) automatikusan törlődnek a CASCADE miatt a schema.sql szerint
  DELETE FROM suspects WHERE id = _suspect_id;

  RETURN json_build_object('success', true, 'message', 'Gyanúsított törölve.');
END;
$$;


ALTER FUNCTION "public"."delete_suspect_safely"("_suspect_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_case_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _badge_full text;
  _badge_suffix text;
  _new_count int;
  _date_str text;
BEGIN
  -- Ha már van megadva ügyszám (pl. migráció), ne bántsuk
  IF NEW.case_number IS NOT NULL AND NEW.case_number <> '' THEN
    RETURN NEW;
  END IF;

  -- 1. Tulajdonos adatainak lekérése és számláló növelése (Atomikus művelet)
  UPDATE public.profiles
  SET lifetime_case_count = COALESCE(lifetime_case_count, 0) + 1
  WHERE id = NEW.owner_id
  RETURNING badge_number, lifetime_case_count INTO _badge_full, _new_count;

  -- Ha valamiért nincs badge number (pl. admin), legyen '0000' fallback
  IF _badge_full IS NULL THEN _badge_full := '0000'; END IF;

  -- 2. Formázás
  -- Jelvény utolsó 3 számjegye
  _badge_suffix := RIGHT(_badge_full, 3);
  
  -- Dátum YYMMDD formátumban
  _date_str := to_char(NOW(), 'YYMMDD');

  -- Formátum: SD-XXX/YYY/ZZZZZZ
  NEW.case_number := 'SD-' || _badge_suffix || '/' || lpad(_new_count::text, 3, '0') || '/' || _date_str;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_case_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_mcb_cases"() RETURNS TABLE("id" "uuid", "case_number" bigint, "title" "text", "status" "public"."case_status_enum", "owner_full_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_my_role text;
BEGIN
  -- Lekérjük a felhasználó rangját a 'get_my_role' függvénnyel
  -- (ami már 'SECURITY DEFINER' és kezeli a rekurziót)
  v_my_role := get_my_role();

  -- Ellenőrizzük, hogy a hívó felhasználó 'lead_detective'-e
  IF v_my_role <> 'lead_detective' THEN
    -- Ha nem az, hibát dobunk
    RAISE EXCEPTION 'Hozzáférés megtagadva: Csak Főnyomozó láthatja az összes aktát.';
  END IF;

  -- Ha 'lead_detective', visszaadjuk az összes aktát, joinolva a tulajdonos nevével
  RETURN QUERY
  SELECT
    c.id,
    c.case_number,
    c.title,
    c.status,
    p.full_name AS owner_full_name
  FROM
    public.cases AS c
  JOIN
    public.profiles AS p ON c.owner_id = p.id
  ORDER BY
    -- A 'Nyitott' akták elöl
    CASE c.status
      WHEN 'open' THEN 1
      WHEN 'closed' THEN 2
      WHEN 'archived' THEN 3
      ELSE 4
    END,
    c.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_all_mcb_cases"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_case_details"("p_case_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    case_data json;
    collaborators_data json;
    my_role text;
    is_involved boolean;
BEGIN
    -- Először is, szerezzük meg a felhasználó rangját
    my_role := get_my_role();

    -- Ellenőrizzük, hogy a felhasználónak van-e egyáltalán köze az aktához
    SELECT EXISTS (
        SELECT 1
        FROM cases c
        LEFT JOIN case_collaborators cc ON c.id = cc.case_id
        WHERE c.id = p_case_id
          AND (
            c.owner_id = auth.uid()
            OR cc.user_id = auth.uid()
            OR my_role = 'lead_detective'
          )
    ) INTO is_involved;

    -- Ha semmi köze hozzá, adjunk vissza hibát
    IF NOT is_involved THEN
        RAISE EXCEPTION 'Hozzáférés megtagadva vagy az akta nem létezik';
    END IF;

    -- 1. Akta és tulajdonos adatainak lekérése
    SELECT
        json_build_object(
            'case', row_to_json(c.*),
            'owner', json_build_object(
                'full_name', p.full_name,
                'role', p.role
            )
        )
    INTO case_data
    FROM cases c
    JOIN profiles p ON c.owner_id = p.id
    WHERE c.id = p_case_id;

    -- 2. Közreműködők adatainak lekérése
    SELECT
        json_agg(
            json_build_object(
                'collaborator', row_to_json(cc.*),
                'user', json_build_object(
                    'full_name', p.full_name,
                    'role', p.role
                )
            )
        )
    INTO collaborators_data
    FROM case_collaborators cc
    JOIN profiles p ON cc.user_id = p.id
    WHERE cc.case_id = p_case_id;

    -- 3. A kettő összefésülése egyetlen JSON objektumba
    RETURN json_build_object(
        'caseDetails', case_data,
        'collaborators', COALESCE(collaborators_data, '[]'::json)
    );
END;
$$;


ALTER FUNCTION "public"."get_case_details"("p_case_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_cases"() RETURNS TABLE("id" "uuid", "case_number" bigint, "title" "text", "status" "public"."case_status_enum", "owner_full_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    c.id,
    c.case_number,
    c.title,
    c.status,
    p.full_name as owner_full_name
  from cases c
  join profiles p on c.owner_id = p.id
  -- Ahol én vagyok a tulajdonos
  where c.owner_id = auth.uid()
  
  union -- (Összefűzi a két lekérdezést)
  
  select
    c.id,
    c.case_number,
    c.title,
    c.status,
    p.full_name as owner_full_name
  from cases c
  join profiles p on c.owner_id = p.id
  join case_collaborators cc on c.id = cc.case_id
  -- Vagy ahol jóváhagyott közreműködő vagyok
  where cc.user_id = auth.uid() and cc.status = 'approved'
$$;


ALTER FUNCTION "public"."get_my_cases"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  -- Létrehozunk egy változót a rang tárolására
  my_role text;
BEGIN
  -- KRITIKUS JAVÍTÁS:
  -- Ideiglenesen kikapcsoljuk az RLS-t CSAK ennek a lekérdezésnek az idejére.
  -- Ez megakadályozza a végtelen rekurziót.
  PERFORM set_config('row_security.off', 'on', true);
  
  -- Lekérjük a rangot a 'my_role' változóba
  SELECT role INTO my_role FROM public.profiles WHERE id = auth.uid();
  
  -- Azonnal visszakapcsoljuk az RLS-t
  PERFORM set_config('row_security.off', 'off', true);
  
  -- Visszaadjuk az eredményt
  RETURN my_role;
END;
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_grading_rights"("_submission_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _viewer_id uuid := auth.uid();
  _viewer_profile public.profiles%ROWTYPE;
  _submission public.exam_submissions%ROWTYPE;
  _exam public.exams%ROWTYPE;
  _applicant_profile public.profiles%ROWTYPE;
  
  -- Rang indexek (segédváltozók)
  _viewer_rank_idx int;
  _applicant_rank_idx int;
  _corporal_idx int;
  
  -- Rang tömbök (szövegesen definiálva az SQL-ben is)
  _supervisory_ranks text[] := ARRAY['Sergeant II.', 'Sergeant I.'];
  _command_ranks text[] := ARRAY['Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.'];
  _executive_ranks text[] := ARRAY['Commander', 'Deputy Commander'];
  _all_ranks text[] := ARRAY[
      'Commander', 'Deputy Commander',
      'Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.',
      'Sergeant II.', 'Sergeant I.',
      'Corporal', 'Staff Deputy Sheriff', 'Senior Deputy Sheriff',
      'Deputy Sheriff III+.', 'Deputy Sheriff III.', 'Deputy Sheriff II.', 'Deputy Sheriff I.', 'Deputy Sheriff Trainee'
  ];
BEGIN
  -- 1. Adatok betöltése
  SELECT * INTO _viewer_profile FROM public.profiles WHERE id = _viewer_id;
  IF _viewer_profile IS NULL THEN RETURN false; END IF;

  -- Bureau Manager (Admin) mindent lát
  IF _viewer_profile.is_bureau_manager THEN RETURN true; END IF;

  SELECT * INTO _submission FROM public.exam_submissions WHERE id = _submission_id;
  -- Ha a user a sajátját nézi, az OK (a feedback_visible majd a frontend/másik logika dolga, de az RLS engedje át az adatot)
  IF _submission.user_id = _viewer_id THEN RETURN true; END IF;

  SELECT * INTO _exam FROM public.exams WHERE id = _submission.exam_id;
  SELECT * INTO _applicant_profile FROM public.profiles WHERE id = _submission.user_id;

  -- 2. Logika szétválasztása Vizsga Típus szerint

  -- A) OSZTÁLY (DIVISION) VIZSGÁK (Ha van divízió megadva)
  IF _exam.division IS NOT NULL AND _exam.division != '' THEN
     -- Bureau Commander mindent lát a divíziókból
     IF _viewer_profile.is_bureau_commander THEN RETURN true; END IF;
     -- Division Commander látja a saját osztályát
     IF _exam.division = ANY(_viewer_profile.commanded_divisions) THEN RETURN true; END IF;
     -- (Itt rang nem számít a kérés szerint: "rangtól függetlenül")
  END IF;

  -- B) ALAP VIZSGÁK (Trainee, Deputy I - vagy nincs divízió)
  IF (_exam.division IS NULL OR _exam.division = '') OR (_exam.type = 'trainee' OR _exam.type = 'deputy_i') THEN
     
     -- Executive / Command Staff: Bárkiét megnézheti ezekből
     IF _viewer_profile.faction_rank = ANY(_executive_ranks) OR _viewer_profile.faction_rank = ANY(_command_ranks) THEN
        RETURN true;
     END IF;

     -- Supervisory Staff: Csak Corporalig (lefelé)
     IF _viewer_profile.faction_rank = ANY(_supervisory_ranks) THEN
        
        -- Ha nincs applicant profil (pl. vendég töltötte ki névvel), akkor engedjük (Trainee vizsga)
        IF _applicant_profile IS NULL THEN RETURN true; END IF;

        -- Rang összehasonlítás
        _applicant_rank_idx := array_position(_all_ranks, _applicant_profile.faction_rank);
        _corporal_idx := array_position(_all_ranks, 'Corporal');
        
        -- Ha a rang tömbben nincs benne, vagy az indexe nagyobb vagy egyenlő mint a Corporal indexe
        -- (A tömbben a nagyobb index = kisebb rang)
        -- Ha _applicant_rank_idx NULL (nincs rangja), akkor is true (Trainee)
        IF _applicant_rank_idx IS NULL OR _applicant_rank_idx >= _corporal_idx THEN
           RETURN true;
        END IF;
     END IF;
     
     -- TB Képesítés (Training Bureau): Ők általában javíthatnak alapképzést
     IF 'TB' = ANY(_viewer_profile.qualifications) THEN RETURN true; END IF;

  END IF;

  -- Ha semmi sem teljesült
  RETURN false;
END;
$$;


ALTER FUNCTION "public"."has_grading_rights"("_submission_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_give_award"("_target_user_id" "uuid", "_ribbon_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _editor_id uuid := auth.uid();
  _is_exec boolean;
  _is_manager boolean;
BEGIN
  SELECT is_bureau_manager, (faction_rank IN ('Commander', 'Deputy Commander')) 
  INTO _is_manager, _is_exec
  FROM public.profiles WHERE id = _editor_id;

  IF _is_manager OR _is_exec THEN
      INSERT INTO user_ribbons (user_id, ribbon_id, awarded_by)
      VALUES (_target_user_id, _ribbon_id, _editor_id);
      
      PERFORM send_hr_notification(_target_user_id, 'Új Kitüntetés!', 'Gratulálunk! Egy új kitüntetést kaptál a vezetőségtől.');
  ELSE
      RAISE EXCEPTION 'Csak az Executive Staff adhat kitüntetést!';
  END IF;
END;
$$;


ALTER FUNCTION "public"."hr_give_award"("_target_user_id" "uuid", "_ribbon_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_update_user_profile"("_target_user_id" "uuid", "_new_rank" "text", "_new_badge" "text", "_new_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _editor_id uuid := auth.uid();
  _editor_profile public.profiles%ROWTYPE;
  _target_profile public.profiles%ROWTYPE;
  
  _editor_rank_idx int;
  _target_rank_idx int;
  _new_rank_idx int;
  
  -- Index határok (hardcoded a biztonság kedvéért, szinkronban a TS-sel)
  -- Commander = 0 ... Trainee = 16
  -- Lieutenant I. (Utolsó Command) kb 6
  -- Sergeant II. (Első Supervisory) kb 7
  -- Corporal kb 9
  
  _all_ranks text[] := ARRAY[
      'Commander', 'Deputy Commander',
      'Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.',
      'Sergeant II.', 'Sergeant I.',
      'Corporal', 'Staff Deputy Sheriff', 'Senior Deputy Sheriff',
      'Deputy Sheriff III+.', 'Deputy Sheriff III.', 'Deputy Sheriff II.', 'Deputy Sheriff I.', 'Deputy Sheriff Trainee'
  ];
BEGIN
  -- Adatok betöltése
  SELECT * INTO _editor_profile FROM public.profiles WHERE id = _editor_id;
  SELECT * INTO _target_profile FROM public.profiles WHERE id = _target_user_id;

  IF _editor_profile IS NULL OR _target_profile IS NULL THEN
    RAISE EXCEPTION 'Profil nem található';
  END IF;

  -- Bureau Manager mindent vihet
  IF _editor_profile.is_bureau_manager THEN
      UPDATE public.profiles 
      SET faction_rank = _new_rank, badge_number = _new_badge, full_name = _new_name
      WHERE id = _target_user_id;
      
      -- Értesítés (Logikát lásd lentebb)
      PERFORM send_hr_notification(_target_user_id, 'Adatlap frissítve', 'A HR osztály (Manager) módosította az adataidat.');
      RETURN;
  END IF;

  -- Indexek számítása
  _editor_rank_idx := array_position(_all_ranks, _editor_profile.faction_rank);
  _target_rank_idx := array_position(_all_ranks, _target_profile.faction_rank);
  _new_rank_idx := array_position(_all_ranks, _new_rank);

  -- JOGOSULTSÁG ELLENŐRZÉS

  -- 1. TB Staff Speciál (Trainee -> Deputy I)
  IF 'TB' = ANY(_editor_profile.qualifications) AND _target_profile.faction_rank = 'Deputy Sheriff Trainee' THEN
      IF _new_rank = 'Deputy Sheriff I.' OR _new_rank = 'Deputy Sheriff Trainee' THEN
          -- Engedélyezve
      ELSE
          RAISE EXCEPTION 'TB Staff csak Deputy Sheriff I. rangig léptethet elő!';
      END IF;
  
  -- 2. Supervisory (Sgt) -> Csak Corporal és lefelé (Index >= 9)
  ELSIF _editor_rank_idx BETWEEN 7 AND 8 THEN -- Sgt II, Sgt I
      IF _target_rank_idx >= 9 AND _new_rank_idx >= 9 THEN
          -- Engedélyezve
      ELSE
          RAISE EXCEPTION 'Supervisory Staff csak Corporal rangig módosíthat!';
      END IF;

  -- 3. Command Staff (Cpt/Lt) -> Csak Supervisory és lefelé (Index >= 7)
  -- A kérés: "Command Staff alattig", tehát Sgt II (7) és lefelé.
  ELSIF _editor_rank_idx BETWEEN 2 AND 6 THEN -- Cpt III ... Lt I
      IF _target_rank_idx >= 7 AND _new_rank_idx >= 7 THEN
          -- Engedélyezve
      ELSE
          RAISE EXCEPTION 'Command Staff csak maguk alatti rangokat módosíthat!';
      END IF;

  -- 4. Executive Staff (Cmdr) -> Bárki (de logikailag magát vagy nagyobbat nem kéne, de a kérés szerint "bárki")
  ELSIF _editor_rank_idx <= 1 THEN
      -- Engedélyezve
  ELSE
      RAISE EXCEPTION 'Nincs jogosultságod módosítani ezt a profilt.';
  END IF;

  -- Ha eljutottunk ide, végrehajtjuk
  UPDATE public.profiles 
  SET faction_rank = _new_rank, badge_number = _new_badge, full_name = _new_name
  WHERE id = _target_user_id;

  -- Értesítés küldése
  PERFORM send_hr_notification(_target_user_id, 'HR Frissítés', 'A vezetőség módosította a rangodat vagy adataidat: ' || _new_rank);

END;
$$;


ALTER FUNCTION "public"."hr_update_user_profile"("_target_user_id" "uuid", "_new_rank" "text", "_new_badge" "text", "_new_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hr_update_user_profile_v2"("_target_user_id" "uuid", "_full_name" "text", "_badge_number" "text", "_faction_rank" "text", "_division" "text", "_division_rank" "text", "_qualifications" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _editor_id uuid := auth.uid();
  _editor public.profiles%ROWTYPE;
  _target public.profiles%ROWTYPE;
  _is_staff boolean;
BEGIN
  SELECT * INTO _editor FROM public.profiles WHERE id = _editor_id;
  SELECT * INTO _target FROM public.profiles WHERE id = _target_user_id;

  -- Alap jogosultság ellenőrzés (Supervisory vagy magasabb)
  _is_staff := _editor.faction_rank IN ('Sergeant I.', 'Sergeant II.', 'Lieutenant I.', 'Lieutenant II.', 'Captain I.', 'Captain II.', 'Captain III.', 'Commander', 'Deputy Commander') OR _editor.is_bureau_manager;

  IF NOT _is_staff THEN
    RAISE EXCEPTION 'Nincs jogosultságod módosításokat végezni.';
  END IF;

  -- 1. BUREAU MANAGER / COMMANDER VÉDELEM
  -- Ha a célpont Bureau Manager vagy Bureau Commander, csak Manager nyúlhat hozzá
  IF (_target.is_bureau_manager OR _target.is_bureau_commander) AND NOT _editor.is_bureau_manager THEN
     RAISE EXCEPTION 'A Bureau vezetőségét csak a Manager módosíthatja.';
  END IF;

  -- 2. DIVISION COMMANDER VÉDELEM (Képesítések)
  -- Ha a szerkesztő nem Manager, és a célpont vezet egy divíziót...
  IF NOT _editor.is_bureau_manager AND array_length(_target.commanded_divisions, 1) > 0 THEN
      -- ...akkor nem vehetjük el tőle a saját divízióját a képesítések közül
      -- (Ez egy egyszerűsített védelem, a frontend is szűr, de itt nem blokkoljuk az egészet, csak figyelmeztetünk kommentben)
      -- A logikát itt most egyszerűre vesszük: Staff módosíthatja a képesítéseket.
  END IF;

  -- UPDATE VÉGREHAJTÁSA
  UPDATE public.profiles 
  SET 
    full_name=_full_name, 
    badge_number=_badge_number, 
    faction_rank=_faction_rank, 
    division=_division, 
    division_rank=_division_rank, 
    qualifications=_qualifications 
  WHERE id=_target_user_id;
END;
$$;


ALTER FUNCTION "public"."hr_update_user_profile_v2"("_target_user_id" "uuid", "_full_name" "text", "_badge_number" "text", "_faction_rank" "text", "_division" "text", "_division_rank" "text", "_qualifications" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reassign_cases_before_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    target_investigator_id UUID;
BEGIN
    -- Keresünk egy "Investigator III." rangú embert (MCB)
    SELECT id INTO target_investigator_id
    FROM public.profiles
    WHERE division = 'MCB' AND division_rank = 'Investigator III.'
    LIMIT 1;

    -- Ha nem találunk, keresünk egy admint vagy Commandert (fallback)
    IF target_investigator_id IS NULL THEN
        SELECT id INTO target_investigator_id
        FROM public.profiles
        WHERE faction_rank = 'Commander' OR system_role = 'admin'
        LIMIT 1;
    END IF;

    -- Ha találtunk valakit, átírjuk az aktákat az ő nevére
    IF target_investigator_id IS NOT NULL THEN
        UPDATE public.cases
        SET owner_id = target_investigator_id
        WHERE owner_id = OLD.id;
        
        -- Opcionális: Értesítést is küldhetünk a rendszernek, de azt inkább triggerrel kéne külön
    END IF;

    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."reassign_cases_before_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reassign_cases_on_leave"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    target_investigator_id UUID;
    is_leaving_mcb BOOLEAN;
BEGIN
    -- Ellenőrizzük, hogy elhagyja-e az MCB-t (vagy törlik)
    is_leaving_mcb := FALSE;
    
    IF (TG_OP = 'DELETE') THEN
        IF OLD.division = 'MCB' THEN is_leaving_mcb := TRUE; END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Ha eddig MCB volt, de most már NEM az
        IF OLD.division = 'MCB' AND NEW.division <> 'MCB' THEN 
            is_leaving_mcb := TRUE; 
        END IF;
    END IF;

    -- Ha nem releváns, kilépünk
    IF NOT is_leaving_mcb THEN
        RETURN NULL; -- Triggerben NULL jó, ha AFTER trigger, de itt BEFORE/AFTER logikától függ
    END IF;

    -- Új tulajdonos keresése
    -- 1. Prioritás: MCB Bureau Commander
    SELECT id INTO target_investigator_id
    FROM public.profiles
    WHERE division = 'MCB' AND is_bureau_commander = true
    LIMIT 1;

    -- 2. Prioritás: Ha nincs Commander, akkor Manager (Admin)
    IF target_investigator_id IS NULL THEN
        SELECT id INTO target_investigator_id
        FROM public.profiles
        WHERE is_bureau_manager = true
        LIMIT 1;
    END IF;

    -- 3. Végső eset: Investigator III.
    IF target_investigator_id IS NULL THEN
        SELECT id INTO target_investigator_id
        FROM public.profiles
        WHERE division = 'MCB' AND division_rank = 'Investigator III.'
        LIMIT 1;
    END IF;

    -- Átírás
    IF target_investigator_id IS NOT NULL THEN
        UPDATE public.cases
        SET owner_id = target_investigator_id
        WHERE owner_id = OLD.id;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."reassign_cases_on_leave"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_hr_notification"("_user_id" "uuid", "_title" "text", "_msg" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_user_id, _title, _msg, 'info');
END;
$$;


ALTER FUNCTION "public"."send_hr_notification"("_user_id" "uuid", "_title" "text", "_msg" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_cases_on_leave"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    target_commander_id UUID;
BEGIN
    -- Csak akkor érdekes, ha MCB-ből megy el valahova máshova
    IF OLD.division = 'MCB' AND NEW.division != 'MCB' THEN
        
        -- Megkeressük az MCB Bureau Commandert
        SELECT id INTO target_commander_id
        FROM public.profiles
        WHERE division = 'MCB' AND is_bureau_commander = true
        LIMIT 1;

        -- Ha nincs parancsnok, keresünk egy Managert
        IF target_commander_id IS NULL THEN
            SELECT id INTO target_commander_id FROM public.profiles WHERE is_bureau_manager = true LIMIT 1;
        END IF;

        -- Ha találtunk embert, átírjuk a nyitott aktákat
        IF target_commander_id IS NOT NULL THEN
            UPDATE public.cases
            SET owner_id = target_commander_id
            WHERE owner_id = OLD.id AND status = 'open';
            
            -- Értesítés az új tulajnak
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (target_commander_id, 'Akták Átvíve', 'Egy nyomozó távozott az osztályról. A nyitott aktái hozzád kerültek.', 'info');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."transfer_cases_on_leave"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_suspect_on_warrant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.status = 'approved' and new.type = 'arrest' and new.suspect_id is not null then
    update public.suspects set status = 'wanted' where id = new.suspect_id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."update_suspect_on_warrant"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."academy_courses" (
    "id" "text" NOT NULL,
    "is_open" boolean DEFAULT false,
    "is_invite_only" boolean DEFAULT false,
    "required_rank" "text",
    "linear_progression" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."academy_courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academy_cycles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "start_date" "date" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "academy_cycles_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."academy_cycles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academy_division_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "text",
    "title" "text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb",
    "page_order" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "theme" "text" DEFAULT 'default'::"text"
);


ALTER TABLE "public"."academy_division_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academy_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid",
    "student_id" "uuid",
    "day_number" integer NOT NULL,
    "is_present" boolean DEFAULT false,
    "note" "text",
    "instructor_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "academy_logs_day_number_check" CHECK ((("day_number" >= 1) AND ("day_number" <= 5)))
);


ALTER TABLE "public"."academy_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academy_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "day_number" integer NOT NULL,
    "page_order" integer DEFAULT 1 NOT NULL,
    "content" "jsonb",
    "category" "text" DEFAULT 'basic'::"text",
    "theme" "text" DEFAULT 'default'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_editor_id" "uuid",
    CONSTRAINT "academy_materials_day_number_check" CHECK ((("day_number" >= 1) AND ("day_number" <= 5)))
);


ALTER TABLE "public"."academy_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academy_progress" (
    "user_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."academy_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academy_students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid",
    "user_id" "uuid",
    "status" "text" DEFAULT 'enrolled'::"text",
    "added_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "academy_students_status_check" CHECK (("status" = ANY (ARRAY['enrolled'::"text", 'passed'::"text", 'failed'::"text", 'dropped'::"text"])))
);


ALTER TABLE "public"."academy_students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."action_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "details" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."action_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "type" "text" DEFAULT 'info'::"text",
    "is_pinned" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "show_author" boolean DEFAULT true
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budget_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "reason" "text" NOT NULL,
    "proof_image_path" "text" DEFAULT '{}'::"text"[] NOT NULL,
    "status" "public"."request_status" DEFAULT 'pending'::"public"."request_status",
    "admin_comment" "text",
    "processed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."budget_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "user_id" "uuid",
    "role" "text" DEFAULT 'editor'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "case_collaborators_role_check" CHECK (("role" = ANY (ARRAY['viewer'::"text", 'editor'::"text"])))
);


ALTER TABLE "public"."case_collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."case_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "user_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."case_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_suspects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "suspect_id" "uuid",
    "involvement_type" "text" DEFAULT 'suspect'::"text",
    "notes" "text",
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."case_suspects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_warrants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "suspect_id" "uuid",
    "target_name" "text",
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "reason" "text" NOT NULL,
    "description" "text",
    "requested_by" "uuid",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid",
    CONSTRAINT "case_warrants_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'executed'::"text", 'expired'::"text"]))),
    CONSTRAINT "case_warrants_type_check" CHECK (("type" = ANY (ARRAY['arrest'::"text", 'search'::"text"])))
);


ALTER TABLE "public"."case_warrants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "body" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'open'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "owner_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "theme" "text" DEFAULT 'default'::"text",
    CONSTRAINT "cases_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "cases_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."cases" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cases_case_number_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cases_case_number_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cases_case_number_seq" OWNED BY "public"."cases"."case_number";



CREATE TABLE IF NOT EXISTS "public"."exam_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid",
    "question_id" "uuid",
    "answer_text" "text",
    "selected_option_ids" "uuid"[],
    "points_awarded" integer DEFAULT 0
);


ALTER TABLE "public"."exam_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exam_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid",
    "option_text" "text" NOT NULL,
    "is_correct" boolean DEFAULT false
);


ALTER TABLE "public"."exam_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exam_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exam_id" "uuid",
    "user_id" "uuid",
    "granted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "access_type" "text" DEFAULT 'allow'::"text",
    CONSTRAINT "exam_overrides_access_type_check" CHECK (("access_type" = ANY (ARRAY['allow'::"text", 'deny'::"text"])))
);


ALTER TABLE "public"."exam_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exam_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exam_id" "uuid",
    "question_text" "text" NOT NULL,
    "question_type" "text" NOT NULL,
    "points" integer DEFAULT 1,
    "order_index" integer DEFAULT 0,
    "is_required" boolean DEFAULT true,
    "page_number" integer DEFAULT 1
);


ALTER TABLE "public"."exam_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exam_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exam_id" "uuid",
    "user_id" "uuid",
    "applicant_name" "text",
    "start_time" timestamp with time zone DEFAULT "now"(),
    "end_time" timestamp with time zone,
    "tab_switch_count" integer DEFAULT 0,
    "total_score" integer DEFAULT 0,
    "max_score" integer DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "graded_by" "uuid",
    "retry_allowed_at" timestamp with time zone,
    "grading_notes" "text",
    "graded_at" timestamp with time zone,
    "feedback_visible" boolean DEFAULT false,
    "claim_token" "text"
);


ALTER TABLE "public"."exam_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "type" "text" NOT NULL,
    "division" "text",
    "required_rank" "text",
    "min_days_in_rank" integer DEFAULT 0,
    "time_limit_minutes" integer DEFAULT 60,
    "passing_percentage" integer DEFAULT 80,
    "is_public" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "allow_sharing" boolean DEFAULT false,
    "is_invitation_only" boolean DEFAULT false
);


ALTER TABLE "public"."exams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text" NOT NULL,
    "badge_number" "text" NOT NULL,
    "avatar_url" "text",
    "faction_rank" "text" DEFAULT 'Deputy Sheriff Trainee'::"text" NOT NULL,
    "division" "text" DEFAULT 'TSB'::"text" NOT NULL,
    "investigator_rank" "text",
    "operator_rank" "text",
    "qualifications" "text"[] DEFAULT '{}'::"text"[],
    "system_role" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "division_rank" "text",
    "last_promotion_date" timestamp with time zone DEFAULT "now"(),
    "is_bureau_manager" boolean DEFAULT false,
    "is_bureau_commander" boolean DEFAULT false,
    "commanded_divisions" "text"[] DEFAULT '{}'::"text"[],
    "onboarding_completed" boolean DEFAULT false,
    "lifetime_case_count" integer DEFAULT 0,
    CONSTRAINT "profiles_badge_number_check" CHECK (("length"("badge_number") = 4)),
    CONSTRAINT "profiles_division_check" CHECK (("division" = ANY (ARRAY['TSB'::"text", 'SEB'::"text", 'MCB'::"text"]))),
    CONSTRAINT "profiles_investigator_rank_check" CHECK (("investigator_rank" = ANY (ARRAY['Investigator III.'::"text", 'Investigator II.'::"text", 'Investigator I.'::"text"]))),
    CONSTRAINT "profiles_operator_rank_check" CHECK (("operator_rank" = ANY (ARRAY['Operator III.'::"text", 'Operator II.'::"text", 'Operator I.'::"text"]))),
    CONSTRAINT "profiles_system_role_check" CHECK (("system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'user'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."exam_submissions_view" WITH ("security_invoker"='true') AS
 SELECT "s"."id",
    "s"."start_time" AS "created_at",
    "s"."exam_id",
    "s"."user_id",
    "s"."status",
    "s"."total_score",
    "s"."max_score",
    "s"."start_time",
    "s"."end_time",
    "s"."tab_switch_count",
    "s"."grading_notes",
    "s"."graded_at",
    "s"."graded_by",
    "s"."feedback_visible",
    "e"."title" AS "exam_title",
    "p"."full_name" AS "user_full_name",
    "p"."badge_number" AS "user_badge_number",
    "s"."applicant_name"
   FROM (("public"."exam_submissions" "s"
     JOIN "public"."exams" "e" ON (("s"."exam_id" = "e"."id")))
     LEFT JOIN "public"."profiles" "p" ON (("s"."user_id" = "p"."id")));


ALTER VIEW "public"."exam_submissions_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."name_change_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "old_name" "text" NOT NULL,
    "new_name" "text" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "changed_by" "uuid"
);


ALTER TABLE "public"."name_change_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" DEFAULT 'info'::"text",
    "is_read" boolean DEFAULT false,
    "link" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['info'::"text", 'success'::"text", 'warning'::"text", 'alert'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ribbons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "color_hex" "text" DEFAULT '#FFD700'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ribbons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suspect_associates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "suspect_id" "uuid",
    "associate_id" "uuid",
    "relationship" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."suspect_associates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suspect_properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "suspect_id" "uuid",
    "address" "text" NOT NULL,
    "property_type" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."suspect_properties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suspect_vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "suspect_id" "uuid",
    "plate_number" "text" NOT NULL,
    "vehicle_type" "text" NOT NULL,
    "color" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."suspect_vehicles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suspects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "alias" "text",
    "gender" "text",
    "gang_affiliation" "text",
    "status" "text" DEFAULT 'free'::"text",
    "description" "text",
    "mugshot_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "suspects_status_check" CHECK (("status" = ANY (ARRAY['free'::"text", 'wanted'::"text", 'jailed'::"text", 'deceased'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."suspects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_status" (
    "id" "text" DEFAULT 'global'::"text" NOT NULL,
    "alert_level" "text" DEFAULT 'normal'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "recruitment_open" boolean DEFAULT true
);


ALTER TABLE "public"."system_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_ribbons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "ribbon_id" "uuid",
    "awarded_at" timestamp with time zone DEFAULT "now"(),
    "awarded_by" "uuid"
);


ALTER TABLE "public"."user_ribbons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "vehicle_type" "text" NOT NULL,
    "vehicle_plate" "text",
    "reason" "text" NOT NULL,
    "status" "public"."request_status" DEFAULT 'pending'::"public"."request_status",
    "admin_comment" "text",
    "processed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."vehicle_requests" OWNER TO "postgres";


ALTER TABLE ONLY "public"."academy_courses"
    ADD CONSTRAINT "academy_courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academy_cycles"
    ADD CONSTRAINT "academy_cycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academy_division_materials"
    ADD CONSTRAINT "academy_division_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academy_logs"
    ADD CONSTRAINT "academy_logs_cycle_id_student_id_day_number_key" UNIQUE ("cycle_id", "student_id", "day_number");



ALTER TABLE ONLY "public"."academy_logs"
    ADD CONSTRAINT "academy_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academy_materials"
    ADD CONSTRAINT "academy_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academy_progress"
    ADD CONSTRAINT "academy_progress_pkey" PRIMARY KEY ("user_id", "material_id");



ALTER TABLE ONLY "public"."academy_students"
    ADD CONSTRAINT "academy_students_cycle_id_user_id_key" UNIQUE ("cycle_id", "user_id");



ALTER TABLE ONLY "public"."academy_students"
    ADD CONSTRAINT "academy_students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."action_logs"
    ADD CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_requests"
    ADD CONSTRAINT "budget_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_collaborators"
    ADD CONSTRAINT "case_collaborators_case_id_user_id_key" UNIQUE ("case_id", "user_id");



ALTER TABLE ONLY "public"."case_collaborators"
    ADD CONSTRAINT "case_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_evidence"
    ADD CONSTRAINT "case_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_notes"
    ADD CONSTRAINT "case_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_suspects"
    ADD CONSTRAINT "case_suspects_case_id_suspect_id_key" UNIQUE ("case_id", "suspect_id");



ALTER TABLE ONLY "public"."case_suspects"
    ADD CONSTRAINT "case_suspects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_warrants"
    ADD CONSTRAINT "case_warrants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exam_answers"
    ADD CONSTRAINT "exam_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exam_options"
    ADD CONSTRAINT "exam_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exam_overrides"
    ADD CONSTRAINT "exam_overrides_exam_id_user_id_key" UNIQUE ("exam_id", "user_id");



ALTER TABLE ONLY "public"."exam_overrides"
    ADD CONSTRAINT "exam_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exam_questions"
    ADD CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exam_submissions"
    ADD CONSTRAINT "exam_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."name_change_logs"
    ADD CONSTRAINT "name_change_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ribbons"
    ADD CONSTRAINT "ribbons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suspect_associates"
    ADD CONSTRAINT "suspect_associates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suspect_associates"
    ADD CONSTRAINT "suspect_associates_suspect_id_associate_id_key" UNIQUE ("suspect_id", "associate_id");



ALTER TABLE ONLY "public"."suspect_properties"
    ADD CONSTRAINT "suspect_properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suspect_vehicles"
    ADD CONSTRAINT "suspect_vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suspects"
    ADD CONSTRAINT "suspects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_status"
    ADD CONSTRAINT "system_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_ribbons"
    ADD CONSTRAINT "user_ribbons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicle_requests"
    ADD CONSTRAINT "vehicle_requests_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_exam_submissions_claim_token" ON "public"."exam_submissions" USING "btree" ("claim_token");



CREATE OR REPLACE TRIGGER "on_exam_submission_consume_invite" AFTER INSERT ON "public"."exam_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."consume_invite_on_submission"();



CREATE OR REPLACE TRIGGER "on_mcb_leave_transfer" AFTER UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."transfer_cases_on_leave"();



CREATE OR REPLACE TRIGGER "on_profile_leave_mcb" AFTER DELETE OR UPDATE OF "division" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."reassign_cases_on_leave"();



CREATE OR REPLACE TRIGGER "on_rank_change_clean_academy" AFTER UPDATE OF "faction_rank" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."clean_academy_data_on_promotion"();



CREATE OR REPLACE TRIGGER "on_warrant_approve" AFTER UPDATE ON "public"."case_warrants" FOR EACH ROW EXECUTE FUNCTION "public"."update_suspect_on_warrant"();



CREATE OR REPLACE TRIGGER "trigger_generate_case_number" BEFORE INSERT ON "public"."cases" FOR EACH ROW EXECUTE FUNCTION "public"."generate_case_number"();



ALTER TABLE ONLY "public"."academy_cycles"
    ADD CONSTRAINT "academy_cycles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."academy_division_materials"
    ADD CONSTRAINT "academy_division_materials_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."academy_courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."academy_logs"
    ADD CONSTRAINT "academy_logs_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."academy_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."academy_logs"
    ADD CONSTRAINT "academy_logs_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."academy_logs"
    ADD CONSTRAINT "academy_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."academy_materials"
    ADD CONSTRAINT "academy_materials_last_editor_id_fkey" FOREIGN KEY ("last_editor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."academy_progress"
    ADD CONSTRAINT "academy_progress_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."academy_division_materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."academy_progress"
    ADD CONSTRAINT "academy_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."academy_students"
    ADD CONSTRAINT "academy_students_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."academy_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."academy_students"
    ADD CONSTRAINT "academy_students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."action_logs"
    ADD CONSTRAINT "action_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."budget_requests"
    ADD CONSTRAINT "budget_requests_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."budget_requests"
    ADD CONSTRAINT "budget_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_collaborators"
    ADD CONSTRAINT "case_collaborators_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_collaborators"
    ADD CONSTRAINT "case_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_evidence"
    ADD CONSTRAINT "case_evidence_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_evidence"
    ADD CONSTRAINT "case_evidence_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_notes"
    ADD CONSTRAINT "case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_notes"
    ADD CONSTRAINT "case_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_suspects"
    ADD CONSTRAINT "case_suspects_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_suspects"
    ADD CONSTRAINT "case_suspects_suspect_id_fkey" FOREIGN KEY ("suspect_id") REFERENCES "public"."suspects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_warrants"
    ADD CONSTRAINT "case_warrants_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_warrants"
    ADD CONSTRAINT "case_warrants_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_warrants"
    ADD CONSTRAINT "case_warrants_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."suspect_properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_warrants"
    ADD CONSTRAINT "case_warrants_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_warrants"
    ADD CONSTRAINT "case_warrants_suspect_id_fkey" FOREIGN KEY ("suspect_id") REFERENCES "public"."suspects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."exam_answers"
    ADD CONSTRAINT "exam_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."exam_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_answers"
    ADD CONSTRAINT "exam_answers_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."exam_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_options"
    ADD CONSTRAINT "exam_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."exam_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_overrides"
    ADD CONSTRAINT "exam_overrides_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_overrides"
    ADD CONSTRAINT "exam_overrides_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exam_overrides"
    ADD CONSTRAINT "exam_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_questions"
    ADD CONSTRAINT "exam_questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_submissions"
    ADD CONSTRAINT "exam_submissions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_submissions"
    ADD CONSTRAINT "exam_submissions_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exam_submissions"
    ADD CONSTRAINT "exam_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."name_change_logs"
    ADD CONSTRAINT "name_change_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."name_change_logs"
    ADD CONSTRAINT "name_change_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suspect_associates"
    ADD CONSTRAINT "suspect_associates_associate_id_fkey" FOREIGN KEY ("associate_id") REFERENCES "public"."suspects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suspect_associates"
    ADD CONSTRAINT "suspect_associates_suspect_id_fkey" FOREIGN KEY ("suspect_id") REFERENCES "public"."suspects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suspect_properties"
    ADD CONSTRAINT "suspect_properties_suspect_id_fkey" FOREIGN KEY ("suspect_id") REFERENCES "public"."suspects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suspect_vehicles"
    ADD CONSTRAINT "suspect_vehicles_suspect_id_fkey" FOREIGN KEY ("suspect_id") REFERENCES "public"."suspects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suspects"
    ADD CONSTRAINT "suspects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."system_status"
    ADD CONSTRAINT "system_status_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_ribbons"
    ADD CONSTRAINT "user_ribbons_awarded_by_fkey" FOREIGN KEY ("awarded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_ribbons"
    ADD CONSTRAINT "user_ribbons_ribbon_id_fkey" FOREIGN KEY ("ribbon_id") REFERENCES "public"."ribbons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_ribbons"
    ADD CONSTRAINT "user_ribbons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicle_requests"
    ADD CONSTRAINT "vehicle_requests_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."vehicle_requests"
    ADD CONSTRAINT "vehicle_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Access_Exam_Options" ON "public"."exam_options" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."exam_questions" "q"
     JOIN "public"."exams" "e" ON (("q"."exam_id" = "e"."id")))
  WHERE (("q"."id" = "exam_options"."question_id") AND (("e"."is_public" = true) OR ("auth"."role"() = 'authenticated'::"text"))))));



CREATE POLICY "Access_Exam_Questions" ON "public"."exam_questions" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."exams"
  WHERE (("exams"."id" = "exam_questions"."exam_id") AND (("exams"."is_public" = true) OR ("auth"."role"() = 'authenticated'::"text"))))));



CREATE POLICY "Access_Exams" ON "public"."exams" FOR SELECT TO "authenticated", "anon" USING ((("is_public" = true) OR ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Adminok kezelhetik a kurzusokat" ON "public"."academy_courses" USING (true);



CREATE POLICY "Adminok kezelhetik a tananyagot" ON "public"."academy_division_materials" USING (true);



CREATE POLICY "Admins (Executive) can update budget requests" ON "public"."budget_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."system_role" = 'admin'::"text")))));



CREATE POLICY "Admins (Executive) can view all budget requests" ON "public"."budget_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."system_role" = 'admin'::"text")))));



CREATE POLICY "Admins can update requests" ON "public"."vehicle_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))))));



CREATE POLICY "Admins can view all requests" ON "public"."vehicle_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))))));



CREATE POLICY "Anyone can insert answers" ON "public"."exam_answers" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert submissions" ON "public"."exam_submissions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Authenticated users can insert notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Bejelentkezettek írhatják" ON "public"."action_logs" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Bizonyítékok kezelése" ON "public"."case_evidence" USING ((EXISTS ( SELECT 1
   FROM "public"."cases"
  WHERE ("cases"."id" = "case_evidence"."case_id"))));



CREATE POLICY "Cycles access" ON "public"."academy_cycles" USING (true);



CREATE POLICY "Gyanúsítottak kezelése" ON "public"."suspects" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."division" = 'MCB'::"text") OR ("profiles"."system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])))))));



CREATE POLICY "Gyanúsítottak megtekintése" ON "public"."suspects" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Ingatlanok kezelése" ON "public"."suspect_properties" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."division" = 'MCB'::"text") OR ("profiles"."system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])))))));



CREATE POLICY "Ingatlanok megtekintése" ON "public"."suspect_properties" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Jegyzetek hozzáférés" ON "public"."case_notes" USING ((EXISTS ( SELECT 1
   FROM "public"."cases"
  WHERE ("cases"."id" = "case_notes"."case_id"))));



CREATE POLICY "Jogosultak kezelhetik" ON "public"."system_status" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))))));



CREATE POLICY "Járművek kezelése" ON "public"."suspect_vehicles" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."division" = 'MCB'::"text") OR ("profiles"."system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])))))));



CREATE POLICY "Járművek megtekintése" ON "public"."suspect_vehicles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Kapcsolatok kezelése" ON "public"."case_suspects" USING ((EXISTS ( SELECT 1
   FROM "public"."cases"
  WHERE ("cases"."id" = "case_suspects"."case_id"))));



CREATE POLICY "Kapcsolatok kezelése" ON "public"."suspect_associates" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."division" = 'MCB'::"text") OR ("profiles"."system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])))))));



CREATE POLICY "Kapcsolatok megtekintése" ON "public"."case_suspects" FOR SELECT USING (true);



CREATE POLICY "Kapcsolatok megtekintése" ON "public"."suspect_associates" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Közreműködő Megtekintés" ON "public"."cases" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."case_collaborators"
  WHERE (("case_collaborators"."case_id" = "cases"."id") AND ("case_collaborators"."user_id" = "auth"."uid"())))));



CREATE POLICY "Közreműködők kezelése" ON "public"."case_collaborators" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."cases"
  WHERE (("cases"."id" = "case_collaborators"."case_id") AND ("cases"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])))))));



CREATE POLICY "Közreműködők megtekintése" ON "public"."case_collaborators" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Közreműködők törlése" ON "public"."case_collaborators" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."cases"
  WHERE (("cases"."id" = "case_collaborators"."case_id") AND ("cases"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])))))));



CREATE POLICY "Logs access" ON "public"."academy_logs" USING (true);



CREATE POLICY "Logs are viewable by everyone" ON "public"."name_change_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "MCB Létrehozás" ON "public"."cases" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."division" = 'MCB'::"text") OR ("profiles"."system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])))))));



CREATE POLICY "MCB Megtekintés" ON "public"."cases" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."division" = 'MCB'::"text") OR ("profiles"."system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])) OR ("profiles"."faction_rank" = ANY (ARRAY['Commander'::"text", 'Deputy Commander'::"text", 'Captain III.'::"text", 'Captain II.'::"text", 'Captain I.'::"text", 'Lieutenant II.'::"text", 'Lieutenant I.'::"text"])))))));



CREATE POLICY "MCB Szerkesztés" ON "public"."cases" FOR UPDATE USING ((("auth"."uid"() = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."case_collaborators"
  WHERE (("case_collaborators"."case_id" = "cases"."id") AND ("case_collaborators"."user_id" = "auth"."uid"()) AND ("case_collaborators"."role" = 'editor'::"text"))))));



CREATE POLICY "Management can manage exams" ON "public"."exams" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."is_bureau_manager" = true) OR ("profiles"."is_bureau_commander" = true) OR ("array_length"("profiles"."commanded_divisions", 1) > 0))))));



CREATE POLICY "Management can manage options" ON "public"."exam_options" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."is_bureau_manager" = true) OR ("profiles"."is_bureau_commander" = true) OR ("array_length"("profiles"."commanded_divisions", 1) > 0))))));



CREATE POLICY "Management can manage questions" ON "public"."exam_questions" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."is_bureau_manager" = true) OR ("profiles"."is_bureau_commander" = true) OR ("array_length"("profiles"."commanded_divisions", 1) > 0))))));



CREATE POLICY "Management can update answers" ON "public"."exam_answers" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."is_bureau_manager" = true) OR ("profiles"."is_bureau_commander" = true) OR ("array_length"("profiles"."commanded_divisions", 1) > 0) OR ('TB'::"text" = ANY ("profiles"."qualifications")) OR ("profiles"."faction_rank" = ANY (ARRAY['Sergeant I.'::"text", 'Sergeant II.'::"text", 'Commander'::"text", 'Deputy Commander'::"text", 'Captain III.'::"text", 'Captain II.'::"text", 'Captain I.'::"text", 'Lieutenant II.'::"text", 'Lieutenant I.'::"text"])))))));



CREATE POLICY "Management can update submissions" ON "public"."exam_submissions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."is_bureau_manager" = true) OR ("profiles"."is_bureau_commander" = true) OR ("array_length"("profiles"."commanded_divisions", 1) > 0) OR ('TB'::"text" = ANY ("profiles"."qualifications")) OR ("profiles"."faction_rank" = ANY (ARRAY['Sergeant I.'::"text", 'Sergeant II.'::"text", 'Commander'::"text", 'Deputy Commander'::"text", 'Captain III.'::"text", 'Captain II.'::"text", 'Captain I.'::"text", 'Lieutenant II.'::"text", 'Lieutenant I.'::"text"])))))));



CREATE POLICY "Management can view answers" ON "public"."exam_answers" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."is_bureau_manager" = true) OR ("profiles"."is_bureau_commander" = true) OR ("array_length"("profiles"."commanded_divisions", 1) > 0) OR ('TB'::"text" = ANY ("profiles"."qualifications")) OR ("profiles"."faction_rank" = ANY (ARRAY['Sergeant I.'::"text", 'Sergeant II.'::"text", 'Commander'::"text", 'Deputy Commander'::"text", 'Captain III.'::"text", 'Captain II.'::"text", 'Captain I.'::"text", 'Lieutenant II.'::"text", 'Lieutenant I.'::"text"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."exam_submissions"
  WHERE (("exam_submissions"."id" = "exam_answers"."submission_id") AND ("exam_submissions"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Mindenki olvashatja" ON "public"."action_logs" FOR SELECT USING (true);



CREATE POLICY "Mindenki olvashatja" ON "public"."announcements" FOR SELECT USING (true);



CREATE POLICY "Mindenki olvashatja" ON "public"."system_status" FOR SELECT USING (true);



CREATE POLICY "Mindenki olvashatja a kurzusokat" ON "public"."academy_courses" FOR SELECT USING (true);



CREATE POLICY "Mindenki olvashatja a tananyagot" ON "public"."academy_division_materials" FOR SELECT USING (true);



CREATE POLICY "Parancsok igénylése" ON "public"."case_warrants" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."cases"
  WHERE ("cases"."id" = "case_warrants"."case_id"))));



CREATE POLICY "Parancsok kezelése" ON "public"."case_warrants" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])) OR ("profiles"."faction_rank" = ANY (ARRAY['Commander'::"text", 'Deputy Commander'::"text", 'Captain III.'::"text", 'Captain II.'::"text", 'Captain I.'::"text", 'Lieutenant II.'::"text", 'Lieutenant I.'::"text"])))))));



CREATE POLICY "Parancsok olvasása" ON "public"."case_warrants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."cases"
  WHERE ("cases"."id" = "case_warrants"."case_id"))));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Public read access" ON "public"."academy_materials" FOR SELECT USING (true);



CREATE POLICY "Ribbons are viewable by everyone" ON "public"."ribbons" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Saját progresszió olvasása" ON "public"."academy_progress" FOR SELECT USING (true);



CREATE POLICY "Saját progresszió írása" ON "public"."academy_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Secure access for exam answers" ON "public"."exam_answers" FOR SELECT TO "authenticated" USING ("public"."has_grading_rights"("submission_id"));



CREATE POLICY "Secure access for exam submissions" ON "public"."exam_submissions" FOR SELECT TO "authenticated" USING ("public"."has_grading_rights"("id"));



CREATE POLICY "Staff full access overrides" ON "public"."exam_overrides" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles")));



CREATE POLICY "Staff write access" ON "public"."academy_materials" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles")));



CREATE POLICY "Students access" ON "public"."academy_students" USING (true);



CREATE POLICY "User ribbons are viewable by everyone" ON "public"."user_ribbons" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can create budget requests" ON "public"."budget_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create requests" ON "public"."vehicle_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own budget requests" ON "public"."budget_requests" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own overrides" ON "public"."exam_overrides" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own requests" ON "public"."vehicle_requests" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own submissions" ON "public"."exam_submissions" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."is_bureau_manager" = true) OR ("profiles"."is_bureau_commander" = true) OR ("array_length"("profiles"."commanded_divisions", 1) > 0)))))));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Vezetők kezelhetik" ON "public"."announcements" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."system_role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])) OR ("profiles"."faction_rank" = ANY (ARRAY['Sergeant I.'::"text", 'Sergeant II.'::"text", 'Lieutenant I.'::"text", 'Lieutenant II.'::"text", 'Captain I.'::"text", 'Captain II.'::"text", 'Captain III.'::"text", 'Commander'::"text", 'Deputy Commander'::"text"])))))));



ALTER TABLE "public"."academy_courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."academy_cycles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."academy_division_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."academy_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."academy_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."academy_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."academy_students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."action_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budget_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_evidence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_suspects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_warrants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exam_answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exam_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exam_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exam_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exam_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."name_change_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ribbons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suspect_associates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suspect_properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suspect_vehicles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suspects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_ribbons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicle_requests" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."admin_assign_exam"("_submission_id" "uuid", "_target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_assign_exam"("_submission_id" "uuid", "_target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_assign_exam"("_submission_id" "uuid", "_target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."change_user_name"("_new_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."change_user_name"("_new_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_user_name"("_new_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_exam_submission"("_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_exam_submission"("_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_exam_submission"("_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."clean_academy_data_on_promotion"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_academy_data_on_promotion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_academy_data_on_promotion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_onboarding"() TO "anon";
GRANT ALL ON FUNCTION "public"."complete_onboarding"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_onboarding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_invite_on_submission"() TO "anon";
GRANT ALL ON FUNCTION "public"."consume_invite_on_submission"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_invite_on_submission"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_case_securely"("_case_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_case_securely"("_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_case_securely"("_case_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_full_exam"("_exam_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_full_exam"("_exam_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_full_exam"("_exam_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_suspect_safely"("_suspect_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_suspect_safely"("_suspect_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_suspect_safely"("_suspect_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_case_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_case_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_case_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_mcb_cases"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_mcb_cases"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_mcb_cases"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_case_details"("p_case_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_case_details"("p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_case_details"("p_case_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_cases"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_cases"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_cases"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_grading_rights"("_submission_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_grading_rights"("_submission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_grading_rights"("_submission_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."hr_give_award"("_target_user_id" "uuid", "_ribbon_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."hr_give_award"("_target_user_id" "uuid", "_ribbon_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_give_award"("_target_user_id" "uuid", "_ribbon_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."hr_update_user_profile"("_target_user_id" "uuid", "_new_rank" "text", "_new_badge" "text", "_new_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hr_update_user_profile"("_target_user_id" "uuid", "_new_rank" "text", "_new_badge" "text", "_new_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_update_user_profile"("_target_user_id" "uuid", "_new_rank" "text", "_new_badge" "text", "_new_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hr_update_user_profile_v2"("_target_user_id" "uuid", "_full_name" "text", "_badge_number" "text", "_faction_rank" "text", "_division" "text", "_division_rank" "text", "_qualifications" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."hr_update_user_profile_v2"("_target_user_id" "uuid", "_full_name" "text", "_badge_number" "text", "_faction_rank" "text", "_division" "text", "_division_rank" "text", "_qualifications" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hr_update_user_profile_v2"("_target_user_id" "uuid", "_full_name" "text", "_badge_number" "text", "_faction_rank" "text", "_division" "text", "_division_rank" "text", "_qualifications" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."reassign_cases_before_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."reassign_cases_before_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reassign_cases_before_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reassign_cases_on_leave"() TO "anon";
GRANT ALL ON FUNCTION "public"."reassign_cases_on_leave"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reassign_cases_on_leave"() TO "service_role";



GRANT ALL ON FUNCTION "public"."send_hr_notification"("_user_id" "uuid", "_title" "text", "_msg" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."send_hr_notification"("_user_id" "uuid", "_title" "text", "_msg" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_hr_notification"("_user_id" "uuid", "_title" "text", "_msg" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_cases_on_leave"() TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_cases_on_leave"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_cases_on_leave"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_suspect_on_warrant"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_suspect_on_warrant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_suspect_on_warrant"() TO "service_role";


















GRANT ALL ON TABLE "public"."academy_courses" TO "anon";
GRANT ALL ON TABLE "public"."academy_courses" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_courses" TO "service_role";



GRANT ALL ON TABLE "public"."academy_cycles" TO "anon";
GRANT ALL ON TABLE "public"."academy_cycles" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_cycles" TO "service_role";



GRANT ALL ON TABLE "public"."academy_division_materials" TO "anon";
GRANT ALL ON TABLE "public"."academy_division_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_division_materials" TO "service_role";



GRANT ALL ON TABLE "public"."academy_logs" TO "anon";
GRANT ALL ON TABLE "public"."academy_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_logs" TO "service_role";



GRANT ALL ON TABLE "public"."academy_materials" TO "anon";
GRANT ALL ON TABLE "public"."academy_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_materials" TO "service_role";



GRANT ALL ON TABLE "public"."academy_progress" TO "anon";
GRANT ALL ON TABLE "public"."academy_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_progress" TO "service_role";



GRANT ALL ON TABLE "public"."academy_students" TO "anon";
GRANT ALL ON TABLE "public"."academy_students" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_students" TO "service_role";



GRANT ALL ON TABLE "public"."action_logs" TO "anon";
GRANT ALL ON TABLE "public"."action_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."action_logs" TO "service_role";



GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."budget_requests" TO "anon";
GRANT ALL ON TABLE "public"."budget_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_requests" TO "service_role";



GRANT ALL ON TABLE "public"."case_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."case_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."case_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."case_evidence" TO "anon";
GRANT ALL ON TABLE "public"."case_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."case_evidence" TO "service_role";



GRANT ALL ON TABLE "public"."case_notes" TO "anon";
GRANT ALL ON TABLE "public"."case_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."case_notes" TO "service_role";



GRANT ALL ON TABLE "public"."case_suspects" TO "anon";
GRANT ALL ON TABLE "public"."case_suspects" TO "authenticated";
GRANT ALL ON TABLE "public"."case_suspects" TO "service_role";



GRANT ALL ON TABLE "public"."case_warrants" TO "anon";
GRANT ALL ON TABLE "public"."case_warrants" TO "authenticated";
GRANT ALL ON TABLE "public"."case_warrants" TO "service_role";



GRANT ALL ON TABLE "public"."cases" TO "anon";
GRANT ALL ON TABLE "public"."cases" TO "authenticated";
GRANT ALL ON TABLE "public"."cases" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cases_case_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cases_case_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cases_case_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."exam_answers" TO "anon";
GRANT ALL ON TABLE "public"."exam_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_answers" TO "service_role";



GRANT ALL ON TABLE "public"."exam_options" TO "anon";
GRANT ALL ON TABLE "public"."exam_options" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_options" TO "service_role";



GRANT ALL ON TABLE "public"."exam_overrides" TO "anon";
GRANT ALL ON TABLE "public"."exam_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."exam_questions" TO "anon";
GRANT ALL ON TABLE "public"."exam_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_questions" TO "service_role";



GRANT ALL ON TABLE "public"."exam_submissions" TO "anon";
GRANT ALL ON TABLE "public"."exam_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."exams" TO "anon";
GRANT ALL ON TABLE "public"."exams" TO "authenticated";
GRANT ALL ON TABLE "public"."exams" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."exam_submissions_view" TO "anon";
GRANT ALL ON TABLE "public"."exam_submissions_view" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_submissions_view" TO "service_role";



GRANT ALL ON TABLE "public"."name_change_logs" TO "anon";
GRANT ALL ON TABLE "public"."name_change_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."name_change_logs" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."ribbons" TO "anon";
GRANT ALL ON TABLE "public"."ribbons" TO "authenticated";
GRANT ALL ON TABLE "public"."ribbons" TO "service_role";



GRANT ALL ON TABLE "public"."suspect_associates" TO "anon";
GRANT ALL ON TABLE "public"."suspect_associates" TO "authenticated";
GRANT ALL ON TABLE "public"."suspect_associates" TO "service_role";



GRANT ALL ON TABLE "public"."suspect_properties" TO "anon";
GRANT ALL ON TABLE "public"."suspect_properties" TO "authenticated";
GRANT ALL ON TABLE "public"."suspect_properties" TO "service_role";



GRANT ALL ON TABLE "public"."suspect_vehicles" TO "anon";
GRANT ALL ON TABLE "public"."suspect_vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."suspect_vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."suspects" TO "anon";
GRANT ALL ON TABLE "public"."suspects" TO "authenticated";
GRANT ALL ON TABLE "public"."suspects" TO "service_role";



GRANT ALL ON TABLE "public"."system_status" TO "anon";
GRANT ALL ON TABLE "public"."system_status" TO "authenticated";
GRANT ALL ON TABLE "public"."system_status" TO "service_role";



GRANT ALL ON TABLE "public"."user_ribbons" TO "anon";
GRANT ALL ON TABLE "public"."user_ribbons" TO "authenticated";
GRANT ALL ON TABLE "public"."user_ribbons" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_requests" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_requests" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































-- ---------------------------------------------------------------------------
-- Not covered by `db dump` (public schema only):
-- storage buckets and storage policies, copied from production.
-- ---------------------------------------------------------------------------

INSERT INTO "storage"."buckets" ("id", "name", "public", "allowed_mime_types")
VALUES ('finance_proofs', 'finance_proofs', true, ARRAY['image/*']),
       ('case_evidence', 'case_evidence', true, NULL)
ON CONFLICT ("id") DO NOTHING;

CREATE POLICY "Admins can delete proof" ON "storage"."objects" FOR DELETE USING (
  ("bucket_id" = 'finance_proofs'::"text") AND (EXISTS (
    SELECT 1 FROM "public"."profiles"
    WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."system_role" = 'admin'::"text")))));

CREATE POLICY "Anyone can upload proof" ON "storage"."objects" FOR INSERT WITH CHECK (
  ("bucket_id" = 'finance_proofs'::"text") AND ("auth"."role"() = 'authenticated'::"text"));

CREATE POLICY "Anyone can view proof" ON "storage"."objects" FOR SELECT USING (
  "bucket_id" = 'finance_proofs'::"text");

CREATE POLICY "Evidence Delete" ON "storage"."objects" FOR DELETE USING (
  ("bucket_id" = 'case_evidence'::"text") AND ("auth"."role"() = 'authenticated'::"text"));

CREATE POLICY "Evidence Upload" ON "storage"."objects" FOR INSERT WITH CHECK (
  ("bucket_id" = 'case_evidence'::"text") AND ("auth"."role"() = 'authenticated'::"text"));

CREATE POLICY "Evidence View" ON "storage"."objects" FOR SELECT USING (
  ("bucket_id" = 'case_evidence'::"text") AND ("auth"."role"() = 'authenticated'::"text"));
