# Tasks: order history for support

- [x] 1. Event store with optimistic concurrency on `(order_id, version)`
  - In-memory store for tests and local runs; YSQL store when `DATABASE_URL` is set
  - _Requirements: 1.1, 1.3, 3.1_
- [x] 2. Order aggregate: fold events into state; command rules per the events table in design.md
  - _Requirements: 1.1, 1.2, 2.2_
- [x] 3. Retry on version conflict (23505) and serialization failure (40001), three attempts (L-001)
  - _Requirements: 3.1, 3.2_
- [x] 4. HTTP API for commands, state and history
  - _Requirements: 1.1, 2.1, 2.2_
- [x] 5. Support console: order list, history timeline with actor and reason
  - _Requirements: 2.1, 2.2_
- [ ] 6. Read model for "refunds by reason this week" (next spec)
