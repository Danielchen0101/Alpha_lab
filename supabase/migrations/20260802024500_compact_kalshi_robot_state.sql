-- Keep the Kalshi scheduler's hot state row small enough for Nano compute.
-- Durable fills and observations live in dedicated tables; this JSON artifact
-- only needs a bounded recent decision window for the operator UI.
WITH normalized AS (
  SELECT
    id,
    payload,
    COALESCE((
      SELECT jsonb_agg(item ORDER BY ordinal)
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(payload -> 'decisions') = 'array'
          THEN payload -> 'decisions' ELSE '[]'::jsonb END
      ) WITH ORDINALITY AS decisions(item, ordinal)
      WHERE ordinal <= 50
    ), '[]'::jsonb) AS top_decisions,
    COALESCE((
      SELECT jsonb_agg(item ORDER BY ordinal)
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(payload #> '{modeState,paper,decisions}') = 'array'
          THEN payload #> '{modeState,paper,decisions}' ELSE '[]'::jsonb END
      ) WITH ORDINALITY AS decisions(item, ordinal)
      WHERE ordinal <= 50
    ), '[]'::jsonb) AS paper_decisions,
    COALESCE((
      SELECT jsonb_agg(item ORDER BY ordinal)
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(payload #> '{modeState,real,decisions}') = 'array'
          THEN payload #> '{modeState,real,decisions}' ELSE '[]'::jsonb END
      ) WITH ORDINALITY AS decisions(item, ordinal)
      WHERE ordinal <= 50
    ), '[]'::jsonb) AS real_decisions
  FROM public.user_operation_artifacts
  WHERE artifact_type = 'kalshi_robot_state'
    AND artifact_key = 'current'
), compacted AS (
  SELECT
    id,
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(payload, '{decisions}', top_decisions, true),
              '{decisionLimit}', '50'::jsonb, true
            ),
            '{modeState,paper,decisions}', paper_decisions, true
          ),
          '{modeState,paper,decisionLimit}', '50'::jsonb, true
        ),
        '{modeState,real,decisions}', real_decisions, true
      ),
      '{modeState,real,decisionLimit}', '50'::jsonb, true
    ) AS payload
  FROM normalized
)
UPDATE public.user_operation_artifacts AS artifact
SET payload = compacted.payload,
    updated_at = now()
FROM compacted
WHERE artifact.id = compacted.id
  AND artifact.payload IS DISTINCT FROM compacted.payload;
