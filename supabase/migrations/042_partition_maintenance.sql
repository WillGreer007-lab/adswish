-- 042: Dynamic monthly partition maintenance
-- Replaces the `create-clicks-partition-monthly` stub (SELECT 1) with a real
-- dynamic-SQL function that creates the next N months of partitions for both
-- partitioned tables. Safe to run repeatedly: each partition is guarded by
-- `to_regclass(...) IS NULL` so existing partitions are never recreated.
--
-- Partitioned tables (migration 003):
--   clicks_log(clicked_at timestamptz)  PARTITION BY RANGE (clicked_at)
--   daily_conversion_rollups(date date) PARTITION BY RANGE (date)

CREATE OR REPLACE FUNCTION adswish_ensure_monthly_partitions(
  months_ahead integer DEFAULT 3
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  start_month date := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
  m integer;
  month_start date;
  month_end date;
  partition_name text;
  parent_table text;
  created_count integer := 0;
BEGIN
  -- Walk forward from the current month through the requested horizon, creating
  -- any missing partitions for BOTH partitioned tables on the way.
  FOR m IN 0 .. GREATEST(0, months_ahead - 1) LOOP
    month_start := start_month + (m * interval '1 month');
    month_end := month_start + interval '1 month';

    FOR parent_table IN SELECT unnest(ARRAY['clicks_log', 'daily_conversion_rollups']) LOOP
      partition_name := parent_table || '_' || to_char(month_start, 'YYYY_MM');

      -- Skip when the partition already exists (idempotent; also covers the
      -- pre-created 2026_08/09/10 partitions from migration 003).
      IF to_regclass(partition_name) IS NOT NULL THEN
        CONTINUE;
      END IF;

      IF parent_table = 'clicks_log' THEN
        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
          partition_name, parent_table, month_start, month_end
        );
      ELSE
        -- daily_conversion_rollups is partitioned on a `date` column.
        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
          partition_name, parent_table, month_start, month_end
        );
      END IF;

      created_count := created_count + 1;
    END LOOP;
  END LOOP;

  RETURN created_count;
END;
$$;

-- Replace the stub pg_cron job with the real maintenance call. It runs on the
-- 25th of each month (per blueprint: "auto-create partitions on the 25th for
-- the upcoming month"), creating partitions for the next 3 months.
SELECT cron.unschedule('create-clicks-partition-monthly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'create-clicks-partition-monthly'
);

SELECT cron.schedule(
  'create-clicks-partition-monthly',
  '0 0 25 * *',
  $$ SELECT adswish_ensure_monthly_partitions(3); $$
);

-- Also create partitions for the immediate horizon right now so the tables are
-- never left without a valid partition while this job waits for the 25th.
SELECT adswish_ensure_monthly_partitions(3);
