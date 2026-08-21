-- 047: Google OAuth sign-in feature flag (admin-toggleable).
--
-- The Google button on login/signup reads this flag from app_settings
-- (public-read RLS). It stays blurred as "Coming soon" until an admin
-- enables it from the Superadmin dashboard — which should only happen
-- after the OAuth redirect URI is registered in Google Cloud Console.
-- Writes go through the service role (the admin API route), not the app.

INSERT INTO public.app_settings (key, value)
VALUES ('google_oauth_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
