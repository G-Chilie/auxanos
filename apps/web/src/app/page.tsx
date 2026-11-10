'use client';

import React, { useMemo, useState } from 'react';

type CorridorCode = 'NGN' | 'GHS' | 'KES';

interface CorridorSpec {
  code: CorridorCode;
  country: string;
  symbol: string;
  ratePerGbp: number;
  spreadBps: number;
  rail: string;
  localRef: string;
  defaultSourceAmount: number;
}

const CORRIDORS: Record<CorridorCode, CorridorSpec> = {
  NGN: {
    code: 'NGN',
    country: 'Nigeria',
    symbol: '₦',
    ratePerGbp: 2102.72,
    spreadBps: 85,
    rail: 'Paystack Virtual NUBAN -> UK Faster Payments',
    localRef: 'Providus / Paystack NUBAN: 9948271042',
    defaultSourceAmount: 2500000,
  },
  GHS: {
    code: 'GHS',
    country: 'Ghana',
    symbol: 'GH₵',
    ratePerGbp: 20.58,
    spreadBps: 90,
    rail: 'Ghana Mobile Money / GIP -> UK Faster Payments',
    localRef: 'GHS MoMo Collection ID: GHS-MOMO-482910',
    defaultSourceAmount: 25000,
  },
  KES: {
    code: 'KES',
    country: 'Kenya',
    symbol: 'KSh',
    ratePerGbp: 169.76,
    spreadBps: 75,
    rail: 'Safaricom M-Pesa STK -> UK Faster Payments',
    localRef: 'M-Pesa Paybill 884200 • Acc: AUX-KE-7104',
    defaultSourceAmount: 200000,
  },
};

export default function AuxanosDayZeroDashboard() {
  const [selectedCorridor, setSelectedCorridor] = useState<CorridorCode>('NGN');
  const [sourceAmount, setSourceAmount] = useState<number>(2500000);
  const [shareCode, setShareCode] = useState<string>('S48-920-114');
  const [casNumber, setCasNumber] = useState<string>('CAS-MAN-2026-88412');
  const [sponsorName, setSponsorName] = useState<string>('Chief Emmanuel Okafor');
  const [transferPurpose, setTransferPurpose] = useState<string>(
    'UK Tuition & Accommodation Deposit',
  );
  const [activeClearanceCode, setActiveClearanceCode] = useState<string>(
    'AUX-CLR-948201',
  );

  const corridor = CORRIDORS[selectedCorridor];

  const quoteSummary = useMemo(() => {
    const grossGbp = sourceAmount / corridor.ratePerGbp;
    const feeGbp = grossGbp > 50 ? 1.5 : 0;
    const netGbp = Math.max(0, grossGbp - feeGbp);
    return {
      grossGbp: grossGbp.toFixed(2),
      feeGbp: feeGbp.toFixed(2),
      netGbp: netGbp.toFixed(2),
    };
  }, [sourceAmount, corridor]);

  const handleCorridorChange = (code: CorridorCode) => {
    setSelectedCorridor(code);
    setSourceAmount(CORRIDORS[code].defaultSourceAmount);
  };

  const handleIssuePreClearance = (e: React.FormEvent) => {
    e.preventDefault();
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    setActiveClearanceCode(`AUX-CLR-${randomSuffix}`);
  };

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #1E293B',
          paddingBottom: 20,
          marginBottom: 32,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                background: 'linear-gradient(90deg, #38BDF8, #818CF8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              AUXANOS
            </span>
            <span
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 999,
                backgroundColor: '#064E3B',
                color: '#34D399',
                fontWeight: 600,
              }}
            >
              DAY-ZERO UK ACCOUNT ACTIVE
            </span>
          </div>
          <p style={{ margin: '6px 0 0', color: '#94A3B8', fontSize: 14 }}>
            Pre-Arrival UK Banking & Anti-Freeze Cross-Border Infrastructure (NGN • GHS • KES ↔ GBP)
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: '#94A3B8' }}>
            Zero-Trust eVisa Trust Score
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#38BDF8' }}>
            95 / 100 (Verified)
          </div>
        </div>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 24,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            background: 'linear-gradient(145deg, #1E293B 0%, #0F172A 100%)',
            border: '1px solid #334155',
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <span style={{ color: '#94A3B8', fontSize: 13, fontWeight: 600 }}>
              UK PRIMARY CURRENT ACCOUNT (GBP)
            </span>
            <span
              style={{
                fontSize: 12,
                backgroundColor: '#1E3A8A',
                color: '#93C5FD',
                padding: '4px 10px',
                borderRadius: 6,
              }}
            >
              Faster Payments Ready
            </span>
          </div>

          <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 20 }}>
            £3,420.50
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              backgroundColor: '#090D16',
              padding: 16,
              borderRadius: 12,
              border: '1px solid #1E293B',
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#64748B' }}>UK SORT CODE</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                04-00-88
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748B' }}>
                ACCOUNT NUMBER
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                73829104
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: 13,
              color: '#CBD5E1',
              backgroundColor: '#0F172A',
              padding: '12px 14px',
              borderRadius: 10,
              borderLeft: '3px solid #38BDF8',
            }}
          >
            Virtual Visa Debit Card ending in <strong>• 4819</strong> active for
            Apple Pay, TfL Underground, and UK Rent Standing Orders.
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#111827',
            border: '1px solid #1F2937',
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              AFRICA → UK CORRIDOR SETTLEMENT ENGINE
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['NGN', 'GHS', 'KES'] as CorridorCode[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleCorridorChange(code)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #374151',
                    backgroundColor:
                      selectedCorridor === code ? '#2563EB' : '#1F2937',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                color: '#9CA3AF',
                marginBottom: 6,
              }}
            >
              Send from {corridor.country} ({corridor.symbol} {corridor.code})
            </label>
            <input
              type="number"
              value={sourceAmount}
              onChange={(e) => setSourceAmount(Number(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid #374151',
                backgroundColor: '#090D16',
                color: '#F8FAFC',
                fontSize: 18,
                fontWeight: 700,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div
            style={{
              backgroundColor: '#090D16',
              padding: 14,
              borderRadius: 10,
              border: '1px solid #1E293B',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                color: '#94A3B8',
                marginBottom: 6,
              }}
            >
              <span>Effective Corridor Rate:</span>
              <span>
                1 GBP = {corridor.symbol}
                {corridor.ratePerGbp} ({corridor.spreadBps / 100}% spread)
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                color: '#94A3B8',
                marginBottom: 6,
              }}
            >
              <span>Platform Settlement Fee:</span>
              <span>£{quoteSummary.feeGbp}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 16,
                fontWeight: 700,
                color: '#34D399',
                paddingTop: 6,
                borderTop: '1px solid #1E293B',
              }}
            >
              <span>Net Credited to UK GBP Account:</span>
              <span>£{quoteSummary.netGbp}</span>
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#94A3B8' }}>
            <div>
              <strong>Rail:</strong> {corridor.rail}
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Local Collection Ref:</strong> {corridor.localRef}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          backgroundColor: '#111827',
          border: '1px solid #1E293B',
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              Anti-Freeze Source-of-Funds Pre-Clearance Shield
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8' }}>
              Pre-register sponsor tuition and rent transfers from Nigeria, Ghana,
              or Kenya with your UKVI eVisa Share Code so automated AML bots never
              wrongly freeze your rent or school fees.
            </p>
          </div>
          <div
            style={{
              backgroundColor: '#064E3B',
              color: '#6EE7B7',
              padding: '8px 14px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Active Certificate: {activeClearanceCode}
          </div>
        </div>

        <form
          onSubmit={handleIssuePreClearance}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            alignItems: 'end',
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                color: '#94A3B8',
                marginBottom: 6,
              }}
            >
              UKVI eVisa Share Code
            </label>
            <input
              type="text"
              value={shareCode}
              onChange={(e) => setShareCode(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #334155',
                backgroundColor: '#090D16',
                color: '#F8FAFC',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                color: '#94A3B8',
                marginBottom: 6,
              }}
            >
              CAS / CoS Sponsor Reference
            </label>
            <input
              type="text"
              value={casNumber}
              onChange={(e) => setCasNumber(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #334155',
                backgroundColor: '#090D16',
                color: '#F8FAFC',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                color: '#94A3B8',
                marginBottom: 6,
              }}
            >
              Verified Sponsor Name ({corridor.country})
            </label>
            <input
              type="text"
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #334155',
                backgroundColor: '#090D16',
                color: '#F8FAFC',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                color: '#94A3B8',
                marginBottom: 6,
              }}
            >
              Remittance Purpose
            </label>
            <input
              type="text"
              value={transferPurpose}
              onChange={(e) => setTransferPurpose(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #334155',
                backgroundColor: '#090D16',
                color: '#F8FAFC',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              padding: '11px 18px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Generate Pre-Clearance Certificate
          </button>
        </form>
      </section>
    </main>
  );
}
