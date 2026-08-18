-- ============================================
-- 018: Enable RLS on the remaining public reference tables
-- subscription_plans (plan catalog) and app_settings (cron base URL,
-- feature flags) are public reference data: everyone needs to read
-- them, nobody writes from the app (seeded via migrations / service
-- role only).
-- ============================================

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Anyone (authenticated or anonymous) can read the plan catalog.
CREATE POLICY "Public can read subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies: the app never writes plans.
-- Migration seeding and admin writes go through the service role,
-- which bypasses RLS.

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read app settings (they contain the cron base URL, not
-- secrets). Writes are service-role only.
CREATE POLICY "Public can read app settings"
  ON public.app_settings FOR SELECT
  USING (true);
