import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { EscrowVaultService } from './modules/escrow/escrow-vault.service';
import { FxCorridorService } from './modules/fx/fx-corridor.service';
import {
  DayZeroOnboardingRequest,
  KycOnboardingService,
} from './modules/kyc/kyc-onboarding.service';
import { LedgerService } from './modules/ledger/ledger.service';
import { WebhookSecurityService } from './modules/webhooks/webhook-security.service';

export interface AuxanosApiContext {
  server: Server;
  ledgerService: LedgerService;
  kycService: KycOnboardingService;
  fxService: FxCorridorService;
  webhookSecurityService: WebhookSecurityService;
  escrowService: EscrowVaultService;
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => {
      raw += chunk.toString('utf8');
    });
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
      } catch (err) {
        reject(new Error('Invalid JSON request payload.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
  });
  res.end(body);
}

/**
 * Creates the AUXANOS Core Banking HTTP REST API Server wiring all 5 domain engines.
 */
export function createAuxanosApiServer(): AuxanosApiContext {
  const ledgerService = new LedgerService();
  const kycService = new KycOnboardingService(ledgerService);
  const fxService = new FxCorridorService(ledgerService);
  const webhookSecurityService = new WebhookSecurityService();
  const escrowService = new EscrowVaultService(ledgerService);

  const server = createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const url = req.url ?? '/';

    if (method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    try {
      if (method === 'GET' && url === '/health') {
        sendJson(res, 200, {
          status: 'ok',
          service: '@auxanos/api',
          auditChain: ledgerService.verifyAuditChainIntegrity(),
        });
        return;
      }

      if (method === 'GET' && url === '/v1/fx/corridors') {
        sendJson(res, 200, {
          corridors: fxService.getSupportedCorridors(),
        });
        return;
      }

      if (method === 'POST' && url === '/v1/fx/quote') {
        const body = await readJsonBody<{
          sourceCurrency: 'NGN' | 'GHS' | 'KES';
          targetCurrency: 'GBP';
          sourceAmountMinor: string;
        }>(req);

        const quote = fxService.createCorridorQuote({
          sourceCurrency: body.sourceCurrency,
          targetCurrency: body.targetCurrency,
          sourceAmountMinor: BigInt(body.sourceAmountMinor),
        });

        sendJson(res, 201, {
          quoteId: quote.quoteId,
          corridorName: quote.corridorName,
          settlementRail: quote.settlementRail,
          effectiveRateUnitsPerGbp: quote.effectiveRateUnitsPerGbp,
          sourceFormatted: quote.sourceAmount.format(),
          feeFormatted: quote.feeTargetAmount.format(),
          netTargetFormatted: quote.netTargetAmount.format(),
          netTargetMinor: quote.netTargetAmount.amountMinor.toString(),
          expiresAt: quote.expiresAt,
        });
        return;
      }

      if (method === 'POST' && url === '/v1/kyc/day-zero-onboard') {
        const body = await readJsonBody<DayZeroOnboardingRequest>(req);
        const result = kycService.completeDayZeroOnboarding(body);
        sendJson(res, 201, result);
        return;
      }

      if (method === 'GET' && url === '/v1/ledger/audit/verify') {
        sendJson(res, 200, ledgerService.verifyAuditChainIntegrity());
        return;
      }

      sendJson(res, 404, { error: `Route ${method} ${url} not found.` });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unexpected server error';
      sendJson(res, 400, { error: message });
    }
  });

  return {
    server,
    ledgerService,
    kycService,
    fxService,
    webhookSecurityService,
    escrowService,
  };
}
