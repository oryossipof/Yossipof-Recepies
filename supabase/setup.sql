-- ============================================================
-- Yossipof-Recepies — הקמת מסד הנתונים
-- ============================================================
-- הריצו את כל הקובץ פעם אחת בפרויקט Supabase החדש:
--   Supabase Dashboard → SQL Editor → New query → הדביקו → Run
--
-- הקובץ ניתן להרצה חוזרת (idempotent) — אפשר להריץ אותו שוב
-- בבטחה אחרי עדכון בלי לאבד נתונים.
-- ============================================================


-- ------------------------------------------------------------
-- פרופיל משתמש
-- ------------------------------------------------------------
-- שורה אחת לכל משתמש רשום: השם והתמונה שמוצגים ליד כל מתכון
-- שהוא העלה.

CREATE TABLE IF NOT EXISTS public.recipe_profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- קטגוריות
-- ------------------------------------------------------------
-- הקטגוריות משותפות לכל המשתמשים, בדיוק כמו המתכונים עצמם.
-- אין קטגוריות ברירת מחדל — המשתמשים יוצרים אותן במסך ניהול
-- הקטגוריות.

CREATE TABLE IF NOT EXISTS public.recipe_categories (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL,
  created_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- שם קטגוריה ייחודי, בלי תלות באותיות גדולות/קטנות.
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_categories_name
  ON public.recipe_categories (lower(name));


-- ------------------------------------------------------------
-- מתכונים
-- ------------------------------------------------------------
-- שלושת שדות הטקסט נשמרים כ-HTML במכוון: כשמדביקים טקסט מעוצב,
-- ההדגשות והרשימות של המקור צריכות לשרוד את הפירוק לשדות ואת
-- המעבר דרך העורך.

CREATE TABLE IF NOT EXISTS public.recipes (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  ingredients_html  TEXT        NOT NULL DEFAULT '',
  instructions_html TEXT        NOT NULL DEFAULT '',
  notes_html        TEXT,
  image_url         TEXT,
  -- { total_label, total: { calories, protein, fat }, divisions: [{ label, count }] }
  nutrition         JSONB,
  source_kind       TEXT,
  source_ref        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipes_user_id    ON public.recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON public.recipes(created_at DESC);


-- ------------------------------------------------------------
-- שיוך מתכון לקטגוריות (רבים לרבים)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.recipe_category_links (
  recipe_id   UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.recipe_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_category_links_category
  ON public.recipe_category_links(category_id);


-- ------------------------------------------------------------
-- מועדפים
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.recipe_favorites (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id  UUID        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_favorites_recipe ON public.recipe_favorites(recipe_id);


-- ------------------------------------------------------------
-- עדכון אוטומטי של updated_at
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recipe_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recipes_updated_at ON public.recipes;
CREATE TRIGGER trg_recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.recipe_touch_updated_at();

DROP TRIGGER IF EXISTS trg_recipe_profiles_updated_at ON public.recipe_profiles;
CREATE TRIGGER trg_recipe_profiles_updated_at
  BEFORE UPDATE ON public.recipe_profiles
  FOR EACH ROW EXECUTE FUNCTION public.recipe_touch_updated_at();


-- ------------------------------------------------------------
-- יצירת פרופיל אוטומטית בהרשמה
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recipe_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.recipe_profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''), split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recipe_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_recipe_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.recipe_handle_new_user();


-- ============================================================
-- הרשאות (RLS)
-- ============================================================
-- קריאה פתוחה לכל משתמש מחובר: זו במכוון "ספר מתכונים משפחתי"
-- שבו כולם רואים את המתכונים של כולם.
-- כתיבה שמורה לבעלים: רק מי שהעלה מתכון יכול לערוך או למחוק אותו.
-- הקטגוריות הן היוצא מן הכלל — הן אוצר מילים משותף, ולכן כל
-- משתמש מחובר יכול לנהל אותן.

ALTER TABLE public.recipe_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_category_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_favorites      ENABLE ROW LEVEL SECURITY;


-- ---------- פרופילים ----------

DROP POLICY IF EXISTS "profiles readable by signed in users" ON public.recipe_profiles;
CREATE POLICY "profiles readable by signed in users"
  ON public.recipe_profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "own profile insert" ON public.recipe_profiles;
CREATE POLICY "own profile insert"
  ON public.recipe_profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "own profile update" ON public.recipe_profiles;
CREATE POLICY "own profile update"
  ON public.recipe_profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);


-- ---------- קטגוריות ----------

DROP POLICY IF EXISTS "categories readable by signed in users" ON public.recipe_categories;
CREATE POLICY "categories readable by signed in users"
  ON public.recipe_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "categories insert" ON public.recipe_categories;
CREATE POLICY "categories insert"
  ON public.recipe_categories FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "categories update" ON public.recipe_categories;
CREATE POLICY "categories update"
  ON public.recipe_categories FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "categories delete" ON public.recipe_categories;
CREATE POLICY "categories delete"
  ON public.recipe_categories FOR DELETE TO authenticated USING (true);


-- ---------- מתכונים ----------

DROP POLICY IF EXISTS "recipes readable by signed in users" ON public.recipes;
CREATE POLICY "recipes readable by signed in users"
  ON public.recipes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "own recipe insert" ON public.recipes;
CREATE POLICY "own recipe insert"
  ON public.recipes FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "own recipe update" ON public.recipes;
CREATE POLICY "own recipe update"
  ON public.recipes FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "own recipe delete" ON public.recipes;
CREATE POLICY "own recipe delete"
  ON public.recipes FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);


-- ---------- שיוך לקטגוריות ----------

DROP POLICY IF EXISTS "links readable by signed in users" ON public.recipe_category_links;
CREATE POLICY "links readable by signed in users"
  ON public.recipe_category_links FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "links insert for own recipes" ON public.recipe_category_links;
CREATE POLICY "links insert for own recipes"
  ON public.recipe_category_links FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_id AND r.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "links delete for own recipes" ON public.recipe_category_links;
CREATE POLICY "links delete for own recipes"
  ON public.recipe_category_links FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_id AND r.user_id = (SELECT auth.uid())
  ));


-- ---------- מועדפים (פרטיים לכל משתמש) ----------

DROP POLICY IF EXISTS "own favorites select" ON public.recipe_favorites;
CREATE POLICY "own favorites select"
  ON public.recipe_favorites FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "own favorites insert" ON public.recipe_favorites;
CREATE POLICY "own favorites insert"
  ON public.recipe_favorites FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "own favorites delete" ON public.recipe_favorites;
CREATE POLICY "own favorites delete"
  ON public.recipe_favorites FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);


-- ============================================================
-- אחסון תמונות
-- ============================================================
-- שני באקטים ציבוריים לקריאה. הקבצים נשמרים תחת תיקייה בשם
-- מזהה המשתמש, כך שכל אחד יכול לכתוב או למחוק רק את שלו.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('recipe-images',  'recipe-images',  true, 10485760,
    ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('recipe-avatars', 'recipe-avatars', true,  5242880,
    ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "recipe media public read" ON storage.objects;
CREATE POLICY "recipe media public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id IN ('recipe-images', 'recipe-avatars'));

DROP POLICY IF EXISTS "recipe media owner insert" ON storage.objects;
CREATE POLICY "recipe media owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('recipe-images', 'recipe-avatars')
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "recipe media owner update" ON storage.objects;
CREATE POLICY "recipe media owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('recipe-images', 'recipe-avatars')
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id IN ('recipe-images', 'recipe-avatars')
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "recipe media owner delete" ON storage.objects;
CREATE POLICY "recipe media owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('recipe-images', 'recipe-avatars')
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
