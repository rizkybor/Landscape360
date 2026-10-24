-- Points of interest shown on the map (summits, basecamps, water sources, caves...), managed
-- by the admin from the app instead of the bundled src/data/myDataLocation.json, which stays
-- as the offline fallback. Anyone can read published points; only the admin can add, edit or
-- delete them (RLS). Seeded with the points from that file. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.points_of_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE, -- id in myDataLocation.json, for the seed below
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  subtitle TEXT CHECK (char_length(subtitle) <= 120),       -- e.g. "2.958 mdpl", "Permanent"
  description TEXT CHECK (char_length(description) <= 2000),
  category TEXT NOT NULL DEFAULT 'poi'
    CHECK (category IN ('poi', 'mountain', 'basecamp', 'water', 'river', 'cliff', 'cave')),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS points_of_interest_published_idx
  ON public.points_of_interest (is_published, name);

ALTER TABLE public.points_of_interest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads published points of interest" ON public.points_of_interest;
CREATE POLICY "Anyone reads published points of interest" ON public.points_of_interest
  FOR SELECT TO anon, authenticated
  USING (is_published OR public.is_admin());

DROP POLICY IF EXISTS "Admin adds points of interest" ON public.points_of_interest;
CREATE POLICY "Admin adds points of interest" ON public.points_of_interest
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin edits points of interest" ON public.points_of_interest;
CREATE POLICY "Admin edits points of interest" ON public.points_of_interest
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin deletes points of interest" ON public.points_of_interest;
CREATE POLICY "Admin deletes points of interest" ON public.points_of_interest
  FOR DELETE TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.points_of_interest TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.points_of_interest TO authenticated;

-- Keep updated_at current and record who created a point
CREATE OR REPLACE FUNCTION public.points_of_interest_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS points_of_interest_touch ON public.points_of_interest;
CREATE TRIGGER points_of_interest_touch
  BEFORE INSERT OR UPDATE ON public.points_of_interest
  FOR EACH ROW EXECUTE FUNCTION public.points_of_interest_touch();

-- Seed: the points from src/data/myDataLocation.json (category guessed from the name)
INSERT INTO public.points_of_interest (legacy_id, name, subtitle, description, category, lng, lat)
VALUES
  ('1', 'Sekretariat Makopala', 'Sekretariat Makopala - Univ. Budi Luhur', NULL, 'poi', 106.74698, -6.23375),
  ('2', 'BC Gunung Gede Pangrango (TNGGP) via Putri', 'Basecamp Pendakian via Putri', NULL, 'basecamp', 107.01037, -6.75567),
  ('3', 'BC Gunung Gede Pangrango (TNGGP) via Cibodas', 'Basecamp Pendakian via Cibodas', NULL, 'basecamp', 107.00683, -6.73614),
  ('4', 'BC Gunung Gede Pangrango (TNGGP) via Salabintana', 'Basecamp Pendakian via Salabintana', NULL, 'basecamp', 106.96136, -6.84869),
  ('5', 'Gunung Gede (TNGGP)', '2.958 - 2.962 mdpl', 'Gerbang utama menuju gunung ini adalah dari jalur Cibodas dan Cipanas (Gunung Putri) di utara serta jalur Salabintana di arah selatan yang tidak begitu banyak dilalui pendaki. Untuk mencapai lokasi pintu masuk Taman Nasional Gede Pangrango bisa ditempuh melalui rute Jakarta-Bogor-Cibodas dengan waktu sekitar 2,5 jam (± 80 km) menggunakan mobil, atau Bandung-Cipanas-Cibodas dengan waktu 2 jam (± 89 km), dan Bogor-Sukabumi-Salabintana dengan waktu 2 jam (62 km).', 'mountain', 106.9832, -6.78991),
  ('6', 'Gunung Pangrango (TNGGP)', '3.019 mdpl', NULL, 'mountain', 106.96435, -6.77044),
  ('7', 'Mata Air Pos Kandang Badak', 'Permanent', NULL, 'water', 106.97463, -6.7771),
  ('8', 'Mata Air Surya Kencana', 'Permanent', NULL, 'water', 106.98426, -6.79641),
  ('9', 'Mata Air Alun-Alun Mandalawangi', 'Seasonal', NULL, 'water', 106.96389, -6.76939),
  ('10', 'Gunung Sumbul (TNGHS)', '1.916 mdpl', NULL, 'mountain', 106.72202, -6.70923),
  ('11', 'Gunung Salak 2 (TNGHS)', '2.211 mdpl', NULL, 'mountain', 106.72826, -6.70161),
  ('12', 'Gunung Salak 1 (TNGHS)', '2.180 mdpl', NULL, 'mountain', 106.73339, -6.71596),
  ('13', 'Sungai', 'Permanent', NULL, 'river', 106.71259, -6.72038),
  ('14', 'Sungai', 'Seasonal', NULL, 'river', 106.70751, -6.72923),
  ('15', 'Gunung Batu Jonggol', '875 mdpl', NULL, 'mountain', 107.05315, -6.6035),
  ('16', 'BC Gunung Batu Jonggol via Sukamakmur', 'Basecamp Pendakian via Sukamakmur', NULL, 'basecamp', 107.04903, -6.60372),
  ('17', 'Gunung Sanggabuana', '1.291 mdpl', NULL, 'mountain', 107.22063, -6.59049),
  ('18', 'BC Gunung Sanggabuana via Mekarbuana', 'Pos Tiket Pendakian via Mekarbuana', NULL, 'basecamp', 107.22704, -6.57182),
  ('19', 'Gunung Lembu', '673 mdpl', NULL, 'mountain', 107.34027, -6.56148),
  ('20', 'BC Gunung Lembu via Sukatani', 'Pos Tiket Pendakian via Sukatani', NULL, 'basecamp', 107.341, -6.57317),
  ('21', 'Tebing Parang', '650 mdpl', NULL, 'cliff', 107.3462, -6.58816),
  ('22', 'Gua Citamiang', NULL, NULL, 'cave', 106.93012, -6.51773),
  ('23', 'Gua Ciasem', NULL, NULL, 'cave', 106.93106, -6.52156),
  ('24', 'Tebing Jeger', '403 mdpl', NULL, 'cliff', 106.93633, -6.52188)
ON CONFLICT (legacy_id) DO NOTHING;
