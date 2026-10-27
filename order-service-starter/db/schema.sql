-- order-service on YugabyteDB (YSQL): one row per order, status updated in place.
CREATE TABLE IF NOT EXISTS orders (
  id         uuid        PRIMARY KEY,
  customer   text        NOT NULL,
  items      jsonb       NOT NULL,
  total      numeric     NOT NULL,
  status     text        NOT NULL DEFAULT 'PLACED',
  carrier    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
