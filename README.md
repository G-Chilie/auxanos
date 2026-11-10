# AUXANOS (Αὐξάνω)

> **Global Day-Zero Banking & Cross-Border Financial Infrastructure**

**AUXANOS** is a borderless financial platform enabling international students, skilled immigrants, and global citizens to open compliant local accounts from Day Zero and move funds across corridors (`GBP` $\leftrightarrow$ `NGN`, `GHS`, `KES`, and global currencies) without arbitrary account freezes.

---

## Repository Architecture (Enterprise Monorepo)

This repository uses an npm workspace monorepo designed for multi-team scalability and strict domain isolation:

```text
auxanos/
├── apps/
│   ├── api/                # NestJS Core Banking & Payment Engine (Modular DDD)
│   └── web/                # Next.js Client & Operations Console
├── packages/
│   └── shared/             # Shared TypeScript Domain Types, Currency & Money Primitives
├── docker-compose.yml      # Local PostgreSQL 16 & Redis 7 Infrastructure
└── package.json            # Root Workspace Configuration
```

---

## Engineering Standards

1. **Zero-Float Financial Math:** All monetary values are represented strictly in integer minor units (`BigInt` — e.g., pence, kobo, pesewas, cents) paired with an explicit ISO-4217 currency code.
2. **Immutable Double-Entry Accounting:** Every balance change is backed by an atomic, zero-sum journal entry ($\sum \text{Debits} = \sum \text{Credits}$).
3. **Idempotency by Default:** Every state-mutating request requires a deterministic idempotency key.
4. **Feature-by-Feature Delivery:** Every module is unit-tested, reviewed, and locked in via atomic commits.
