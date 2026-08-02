-- The artifact table currently contains only a handful of rows and receives
-- far more updates than scheduler scans. Avoid paying an index-maintenance
-- cost on every robot-state write until table cardinality justifies it.
DROP INDEX IF EXISTS public.user_operation_artifacts_scheduler_lookup_idx;
