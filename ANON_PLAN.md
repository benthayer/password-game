# Payment Integration Plan

## Current State

- Basic credit system exists in [`db.ts`](packages/backend/src/storage/db.ts) with `initial_credits` / `spent_credits`
- [`CreditService`](packages/backend/src/services/credit-service.ts) handles download/upload gating
- No payment integration yet
- Storage on Backblaze B2

---

## V1: Coinbase Integration + Nightly Cron

### Credit Model

| $1 buys | Amount |

|---------|--------|

| Storage | 1 GB-year |

| Egress | 50 GB |

- Files billed at 1 GB minimum
- Nightly cron deducts `file_size_gb / 365` from storage balance
- Display "expires at" calculated from remaining balance

### Schema Changes

Update [`db.ts`](packages/backend/src/storage/db.ts):

```sql
-- Replace integer credits with precise tracking
ALTER TABLE accounts ADD COLUMN gb_years_remaining REAL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN egress_gb_remaining REAL DEFAULT 0;
-- file_size already exists, keep it
```

### Nightly Cron

Create `packages/backend/src/services/nightly-billing.ts`:

```typescript
// For each account with a file:
// 1. Calculate days since last billing (or storage_started_at)
// 2. Deduct: (max(file_size_gb, 1gb) * days) / 365 from gb_years_remaining
// 3. Update last_billed_at
```

---

## Fully Anonymous (Future)

### Core Problems

- File upload timestamp
- Payment timestamp
- Payment linkability
- VPS/Storage/Network Logging


### Goal
- No timestamps anywhere
- Previous state information not recoverable
- Server doesn't know anything about account data without client encryption keys
- Server has mechanism for knowing whether file has expired without knowing anything about encryption
- Server does not link content address to account

#### Options
- Move to Monero
- Move to Sia (Store key publicly but encrypted via this method)
- Move to a private vps
- Improve payment encryption
