# Requirements: order history for support

## Introduction

Support agents get asked "why was my order refunded?" and "who cancelled this?" every day. Today the `orders` table
holds only the current status, so the answer is in someone's inbox or nowhere. This feature records every change to an
order with who made it and why, and shows that history to support.

## Requirement 1: record every change with its reason

**User story:** As a support agent, I want every change to an order recorded with its actor and reason, so that I can
answer "why" without escalating.

### Acceptance criteria

1. WHEN an order is placed, paid, shipped, cancelled or refunded THE SYSTEM SHALL record an event with the order id, a
   per-order version, the event type, the actor and the time.
2. WHEN an order is cancelled or refunded THE SYSTEM SHALL require a reason code from a fixed list and accept an optional note.
3. THE SYSTEM SHALL NOT allow a recorded event to be changed or deleted.

## Requirement 2: show the history

**User story:** As a support agent, I want to see an order's history in order, so that I can explain what happened.

### Acceptance criteria

1. WHEN a support agent opens an order THE SYSTEM SHALL show its events oldest first, each with actor, time, and reason where one exists.
2. WHEN a support agent opens an order THE SYSTEM SHALL show its current state derived from those events.

## Requirement 3: concurrent changes

**User story:** As a support lead, I want two agents acting on the same order at once to get a consistent result, so
that an order is never refunded twice.

### Acceptance criteria

1. IF two changes to the same order are submitted at the same time THEN THE SYSTEM SHALL apply them one after the other
   against the latest state, and reject the second if it is no longer valid.
2. IF a change is rejected because the order changed underneath it THEN THE SYSTEM SHALL retry it against the latest
   state before reporting an error.
