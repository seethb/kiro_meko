-- order-service on YugabyteDB (YSQL). See .kiro/specs/order-history/design.md.
--
-- ADR-001: order state is event-sourced; this table is the source of truth.
-- ADR-002: (order_id HASH, version ASC) spreads orders across tablets and keeps one
--          order's events together in version order. No global sequence: it would
--          funnel every insert into one tablet.
CREATE TABLE IF NOT EXISTS order_events (
  order_id    uuid        NOT NULL,
  version     int         NOT NULL CHECK (version > 0),
  type        text        NOT NULL,
  actor       text        NOT NULL,
  reason_code text,
  note        text,
  payload     jsonb       NOT NULL DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id HASH, version ASC)
);

-- Events are append-only (requirement 1.3).
CREATE OR REPLACE FUNCTION order_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'order_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_events_no_change ON order_events;
CREATE TRIGGER order_events_no_change
  BEFORE UPDATE OR DELETE ON order_events
  FOR EACH ROW EXECUTE FUNCTION order_events_append_only();
