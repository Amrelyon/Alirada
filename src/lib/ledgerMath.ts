import {
  AliradaProfile,
  BatchPayment,
  Investment,
  LedgerMetrics,
  Order,
  PointExchange,
  RecognitionVote,
  RequestedServantLog,
  ServiceLog,
  SystemConfigState,
  TransactionRef,
} from '../types/alirada';

export function deriveServiceTier(scoreEarned: number, upwardVotes: number): string {
  const weighted = scoreEarned + upwardVotes * 25;
  if (weighted >= 1500) return 'Patron Steward';
  if (weighted >= 700) return 'Master Servant';
  if (weighted >= 250) return 'Guild Steward';
  if (weighted >= 60) return 'Active Contributor';
  return 'Initiate';
}

export function computeUserLedgerMetrics(
  profile: AliradaProfile,
  serviceLogs: ServiceLog[],
  deductionLogs: RequestedServantLog[],
  orders: Order[],
  investments: Investment[],
  transactionRefs: TransactionRef[],
  batchPayments: BatchPayment[],
  pointExchanges: PointExchange[],
  recognitionVotes: RecognitionVote[],
  config: SystemConfigState,
  todayIsoDate: string
): LedgerMetrics {
  const uid = profile.universal_id;

  const givenLogs = serviceLogs.filter((l) => l.provider_uid === uid);
  const receivedLogs = serviceLogs.filter((l) => l.recipient_uid === uid);
  const services_given = givenLogs.length;
  const hours_served = givenLogs.reduce((acc, l) => acc + l.hours, 0);
  const score_earned = givenLogs.reduce((acc, l) => acc + l.final_score, 0);
  const today_hours = givenLogs
    .filter((l) => l.logged_date === todayIsoDate)
    .reduce((acc, l) => acc + l.hours, 0);

  const average_hardship =
    services_given > 0
      ? Number((givenLogs.reduce((acc, l) => acc + l.hardship, 0) / services_given).toFixed(2))
      : 0;

  // Deductions from requested servant logs, confirmed/completed orders as buyer, active investments, confirmed outbound refs, batches sent, and escrowed/released point exchanges
  const requestedDeductions = deductionLogs
    .filter((d) => d.requested_servant_uid === uid)
    .reduce((acc, d) => acc + d.deducted_score, 0);

  const ordersSpent = orders
    .filter((o) => o.buyer_uid === uid && o.order_status !== 'Rejected')
    .reduce((acc, o) => acc + o.total_points, 0);

  const ordersEarned = orders
    .filter((o) => o.seller_uid === uid && o.delivery_status === 'Delivered')
    .reduce((acc, o) => acc + o.total_points, 0);

  const investmentsOut = investments
    .filter((i) => i.investor_uid === uid && i.status !== 'Cancelled')
    .reduce((acc, i) => acc + i.invested_points, 0);

  const dividendsIn = investments
    .filter((i) => i.investor_uid === uid)
    .reduce((acc, i) => acc + i.dividends_earned, 0);

  // P2P: issuer pays counterparty when Confirmed. C2P: counterparty pays issuer when Confirmed.
  const refsOut = transactionRefs
    .filter(
      (r) =>
        r.status === 'Confirmed' &&
        ((r.ref_type === 'P2P' && r.issuer_uid === uid) ||
          (r.ref_type === 'C2P' && r.counterparty_uid === uid))
    )
    .reduce((acc, r) => acc + r.points_amount, 0);

  const refsIn = transactionRefs
    .filter(
      (r) =>
        r.status === 'Confirmed' &&
        ((r.ref_type === 'P2P' && r.counterparty_uid === uid) ||
          (r.ref_type === 'C2P' && r.issuer_uid === uid))
    )
    .reduce((acc, r) => acc + r.points_amount, 0);

  const batchOut = batchPayments
    .filter((b) => b.creator_uid === uid && b.send_count > 0)
    .reduce(
      (acc, b) =>
        acc + b.send_count * b.recipients.reduce((s, r) => s + r.points, 0),
      0
    );

  const batchIn = batchPayments
    .filter((b) => b.send_count > 0)
    .reduce((acc, b) => {
      const rec = b.recipients.find((r) => r.uid === uid);
      return acc + (rec ? rec.points * b.send_count : 0);
    }, 0);

  const exchangeOut = pointExchanges
    .filter(
      (e) =>
        e.seller_uid === uid &&
        (e.status === 'Escrow Locked' || e.status === 'Proof Submitted' || e.status === 'Released')
    )
    .reduce((acc, e) => acc + e.points_requested, 0);

  const exchangeIn = pointExchanges
    .filter((e) => e.buyer_uid === uid && e.status === 'Released')
    .reduce((acc, e) => acc + e.points_requested, 0);

  const deductions = Number(
    (requestedDeductions + ordersSpent + investmentsOut + refsOut + batchOut + exchangeOut).toFixed(2)
  );
  const credits_in = Number((ordersEarned + dividendsIn + refsIn + batchIn + exchangeIn).toFixed(2));

  const rawBalance =
    score_earned +
    credits_in -
    deductions -
    profile.penalty_score +
    profile.carried_balance;

  const balance = Number(Math.max(config.negative_points_floor, rawBalance).toFixed(2));

  const upward_votes = recognitionVotes.filter(
    (v) => v.target_uid === uid && v.direction === 'UPWARD'
  ).length;
  const compensate_votes = recognitionVotes.filter(
    (v) => v.target_uid === uid && v.direction === 'COMPENSATE'
  ).length;

  return {
    universal_id: uid,
    services_given,
    hours_served: Number(hours_served.toFixed(2)),
    score_earned: Number(score_earned.toFixed(2)),
    credits_in,
    services_received: receivedLogs.length,
    deductions,
    penalty_score: profile.penalty_score,
    carried_balance: profile.carried_balance,
    balance,
    average_hardship,
    service_tier: deriveServiceTier(score_earned, upward_votes),
    upward_votes,
    compensate_votes,
    today_hours: Number(today_hours.toFixed(2)),
  };
}

export function computeListingDemandCount(listingId: string, orders: Order[]): number {
  return orders.filter((o) => o.listing_id === listingId && o.order_status !== 'Rejected').length;
}

export async function sha256Hex(input: string): Promise<string> {
  const normalized = input.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
