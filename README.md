# AUXANOS (Αὐξάνω)

> **Global Day-Zero Banking & Cross-Border Financial Infrastructure (`GBP` $\leftrightarrow$ `NGN`, `GHS`, `KES`)**

**AUXANOS** solves the UK newcomer banking Catch-22: international students and skilled workers arriving in the United Kingdom need a UK bank account (Sort Code + Account Number) to rent accommodation, sign contracts, or receive salaries/stipends, yet traditional banks and mainstream neobanks reject thin-file newcomers who lack UK proof of address—or freeze their accounts when cross-border tuition and rent remittances arrive from Nigeria, Ghana, or Kenya.

With **AUXANOS**, newcomers onboard **from Day Zero (pre-arrival)** using their biometric passport and UK Home Office **eVisa Share Code (`W`/`S`/`R`) + CAS/CoS sponsor reference**, and pre-clear legitimate incoming funds through our **Anti-Freeze Source-of-Funds Shield**.

---

## Repository Architecture (Enterprise Monorepo)

```text
auxanos/
├── packages/
│   └── shared/                 # @auxanos/shared — Immutable Money Value Object & ISO-4217 Currencies
│       └── src/
│           ├── currencies.ts   # Minor-unit specifications (GBP, NGN, GHS, KES, USD, EUR)
│           ├── money.ts        # Zero-float BigInt Money primitive & basis-point fee math
│           └── money.spec.ts   # Unit tests for currency & minor-unit invariants
├── apps/
│   ├── api/                    # @auxanos/api — Core Banking, Ledger, eVisa KYC & FX Engine
│   │   ├── prisma/
│   │   │   └── schema.prisma   # PostgreSQL schema for Wallets, JournalEntries, KYC & Pre-Clearances
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── ledger/         # ACID Double-Entry Accounting Engine + SHA-256 Hash Chain
│   │       │   ├── kyc/            # UKVI eVisa Share Code Verification & Anti-Freeze Pre-Clearance
│   │       │   ├── fx/             # NGN, GHS, KES -> GBP Rate-Locked Quoting & Two-Leg Settlement
│   │       │   ├── webhooks/       # Constant-Time HMAC-SHA256 Webhook Verifier & Anti-Replay Guard
│   │       │   └── escrow/         # UK Landlord Rent & University Tuition Escrow Vaults
│   │       └── server.ts           # HTTP REST API Server & End-to-End Integration Suite
│   └── web/                        # @auxanos/web — Next.js 14 Day-Zero UK Banking & Corridor Console
├── docker-compose.yml              # Local PostgreSQL 16 & Redis 7 Infrastructure
└── package.json                    # Root Workspace Configuration
```

---

## Engineering & Security Guarantees

1. **Zero-Float Financial Arithmetic (`@auxanos/shared`):** All monetary values are stored and manipulated strictly in integer minor units (`BigInt` — `pence`, `kobo`, `pesewas`, `cents`) paired with an explicit currency code.
2. **Immutable Double-Entry Ledger (`LedgerService`):** Every balance change requires a balanced journal entry ($\sum \text{Debits} = \sum \text{Credits}$) and is linked into a tamper-evident **SHA-256 hash chain** (`previousEntryHash` $\rightarrow$ `entryHash`).
3. **Deterministic Idempotency:** All ledger and settlement mutations require an `idempotencyKey` to prevent double-spending on network retries or webhook replays.
4. **Zero-Trust Pre-Arrival KYC & Anti-Freeze Shield (`KycOnboardingService`):** Verifies UKVI Share Codes and issues cryptographic `SourceOfFundsPreClearance` certificates for sponsor remittances.
5. **Constant-Time Webhook Verification (`WebhookSecurityService`):** Uses `crypto.timingSafeEqual` over `HMAC-SHA256` signatures with a 300-second replay window and event deduplication.
6. **Rent & Tuition Proof-of-Funds Escrow (`EscrowVaultService`):** Locks newcomer GBP rent and tuition funds in isolated escrow wallets with SHA-256 guarantee certificates (`AUX-GUAR-...`).

---

## Running Tests & Local Infrastructure

```bash
# 1. Start local PostgreSQL 16 & Redis 7 containers
npm run db:up

# 2. Run all 18 unit & integration tests across @auxanos/shared and @auxanos/api
npm test
```

---

## Active Engineering Roadmap

- [x] **Phase 1 (Core Foundation):** Zero-float `Money` primitive, Prisma schema, SHA-256 hash-chained `LedgerService`, UKVI eVisa `KycOnboardingService`, `FxCorridorService` (`NGN`/`GHS`/`KES` $\rightarrow$ `GBP`), and Next.js Day-Zero Console.
- [x] **Phase 2 (Security, Escrow & REST API):** Constant-time `HMAC-SHA256` `WebhookSecurityService`, UK landlord/university `EscrowVaultService`, and HTTP REST API Server with end-to-end integration tests.
- [ ] **Phase 3 (Database Persistence & Redis Distributed Locks):** Wire Prisma PostgreSQL repositories and Redis idempotency locks for multi-node horizontal scaling.
- [ ] **Phase 4 (Live BaaS & Payment Rail Adapters):** Connect live sandbox adapters for UK Faster Payments (Griffin/Modulr), Paystack Virtual NUBAN (`NGN`), Ghana Mobile Money (`GHS`), and Safaricom M-Pesa (`KES`).
