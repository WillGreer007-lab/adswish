-- 044: Reviews survive account deletion (GDPR Article 17 vs marketplace integrity)
--
-- Migration 043 made reviewer_id/reviewee_id nullable; this changes the FK
-- behaviour from ON DELETE CASCADE (which would silently erase the numerical
-- rating + date when the author or subject is deleted) to ON DELETE SET NULL.
-- The identity is redacted, the 1–5 rating and timestamp are retained for
-- aggregate marketplace statistics, and written feedback is cleared by the
-- deletion route.

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_reviewer_id_fkey;

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_reviewee_id_fkey;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_reviewer_id_fkey
    FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_reviewee_id_fkey
    FOREIGN KEY (reviewee_id) REFERENCES auth.users(id) ON DELETE SET NULL;
