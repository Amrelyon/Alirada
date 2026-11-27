import {
  AliradaProfile,
  BatchPayment,
  Investment,
  LedgerMetrics,
  Listing,
  Order,
  PointExchange,
  ProjectInvestmentReport,
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

function normUid(uid?: string): string {
  return (uid || '').trim().toUpperCase();
}

function round2(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

export function isC2POrderConnectedRef(r: TransactionRef, orders?: Order[]): boolean {
  if (r.ref_type !== 'C2P') return false;
  if (orders) {
    const orderIds = new Set(orders.map((o) => o.id));
    if (r.linked_order_id && orderIds.has(r.linked_order_id)) return true;
    if ((r.c2p_settlements || []).some((s) => Boolean(s.order_id && orderIds.has(s.order_id)))) {
      return true;
    }
    return orders.some((o) => o.c2p_ref_code === r.ref_code);
  }
  return Boolean(r.linked_listing_code || r.linked_order_id);
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
  const uidNorm = normUid(uid);

  const givenLogs = serviceLogs.filter((l) => normUid(l.provider_uid) === uidNorm);
  const receivedLogs = serviceLogs.filter((l) => normUid(l.recipient_uid) === uidNorm);
  const services_given = givenLogs.length;
  const hours_served = givenLogs.reduce((acc, l) => acc + (Number(l.hours) || 0), 0);
  const score_earned = round2(
    givenLogs.reduce((acc, l) => acc + (Number(l.final_score) || 0), 0)
  );
  const today_hours = givenLogs
    .filter((l) => l.logged_date === todayIsoDate)
    .reduce((acc, l) => acc + (Number(l.hours) || 0), 0);

  const average_hardship =
    services_given > 0
      ? round2(
          givenLogs.reduce((acc, l) => acc + (Number(l.hardship) || 0), 0) / services_given
        )
      : 0;

  // Exclude Disputed servant deduction entries
  const requestedDeductions = round2(
    deductionLogs
      .filter((d) => normUid(d.requested_servant_uid) === uidNorm && d.status !== 'Disputed')
      .reduce((acc, d) => acc + (Number(d.deducted_score) || 0), 0)
  );

  // Exclude Rejected orders for buyer spend; credit seller strictly when Delivered & not Rejected
  const ordersSpent = round2(
    orders
      .filter(
        (o) =>
          normUid(o.buyer_uid) === uidNorm &&
          o.order_status !== 'Rejected' &&
          o.delivery_status !== 'Rejected'
      )
      .reduce((acc, o) => acc + (Number(o.total_points) || 0), 0)
  );

  const ordersEarned = round2(
    orders
      .filter(
        (o) =>
          normUid(o.seller_uid) === uidNorm &&
          o.order_status !== 'Rejected' &&
          o.delivery_status === 'Delivered'
      )
      .reduce((acc, o) => acc + (Number(o.total_points) || 0), 0)
  );

  const investmentsOut = round2(
    investments
      .filter((i) => normUid(i.investor_uid) === uidNorm && i.status !== 'Cancelled')
      .reduce((acc, i) => acc + (Number(i.invested_points) || 0), 0)
  );

  const dividendsIn = round2(
    investments
      .filter((i) => normUid(i.investor_uid) === uidNorm)
      .reduce((acc, i) => acc + (Number(i.dividends_earned) || 0), 0)
  );

  // P2P settles directly via status === 'Confirmed'.
  // C2P settlements backed by an actual Order settle via Orders (never double-counted).
  // Standalone C2P settlements settle via c2p_settlements[] (or fallback Confirmed if no settlements array).
  const orderIds = new Set(orders.map((o) => o.id));
  let refsOut = 0;
  let refsIn = 0;

  for (const r of transactionRefs) {
    if (r.ref_type === 'P2P') {
      if (r.status === 'Confirmed') {
        const amt = Number(r.points_amount) || 0;
        if (normUid(r.issuer_uid) === uidNorm) refsOut += amt;
        if (normUid(r.counterparty_uid) === uidNorm) refsIn += amt;
      }
      continue;
    }

    const settlements = r.c2p_settlements || [];
    if (settlements.length > 0) {
      for (const s of settlements) {
        const amt = Number(s.points_amount) || 0;
        const settledViaOrder = Boolean(
          (s.order_id && orderIds.has(s.order_id)) ||
            (!s.order_id && r.linked_order_id && orderIds.has(r.linked_order_id)) ||
            (!s.order_id &&
              orders.some(
                (o) =>
                  o.c2p_ref_code === r.ref_code &&
                  normUid(o.buyer_uid) === normUid(s.payer_uid) &&
                  Math.abs((Number(o.total_points) || 0) - amt) < 0.01
              ))
        );
        if (settledViaOrder) continue;
        if (normUid(s.payer_uid) === uidNorm) refsOut += amt;
        if (normUid(r.issuer_uid) === uidNorm) refsIn += amt;
      }
    } else if (r.status === 'Confirmed') {
      const hasMatchingOrder = Boolean(
        (r.linked_order_id && orderIds.has(r.linked_order_id)) ||
          orders.some((o) => o.c2p_ref_code === r.ref_code)
      );
      if (hasMatchingOrder) continue;
      const amt = Number(r.points_amount) || 0;
      if (normUid(r.counterparty_uid) === uidNorm) refsOut += amt;
      if (normUid(r.issuer_uid) === uidNorm) refsIn += amt;
    }
  }
  refsOut = round2(refsOut);
  refsIn = round2(refsIn);

  const batchOut = round2(
    batchPayments
      .filter(
        (b) =>
          b.funding_source !== 'PLATFORM_FEES' &&
          normUid(b.creator_uid) === uidNorm &&
          (Number(b.send_count) || 0) > 0
      )
      .reduce(
        (acc, b) =>
          acc +
          (Number(b.send_count) || 0) *
            b.recipients.reduce((s, r) => s + (Number(r.points) || 0), 0),
        0
      )
  );

  // Sum ALL matching recipient rows (fixes multi-row loss when same UID appears multiple times)
  const batchIn = round2(
    batchPayments
      .filter((b) => (Number(b.send_count) || 0) > 0)
      .reduce((acc, b) => {
        const matchedTotal = b.recipients
          .filter((r) => normUid(r.uid) === uidNorm)
          .reduce((s, r) => s + (Number(r.points) || 0), 0);
        return acc + matchedTotal * (Number(b.send_count) || 0);
      }, 0)
  );

  // Deactivated or Cancelled exchanges release escrow back to seller
  const exchangeOut = round2(
    pointExchanges
      .filter(
        (e) =>
          normUid(e.seller_uid) === uidNorm &&
          (e.status === 'Escrow Locked' ||
            e.status === 'Proof Submitted' ||
            e.status === 'Released')
      )
      .reduce((acc, e) => acc + (Number(e.points_requested) || 0), 0)
  );

  const exchangeIn = round2(
    pointExchanges
      .filter((e) => normUid(e.buyer_uid) === uidNorm && e.status === 'Released')
      .reduce((acc, e) => acc + (Number(e.points_requested) || 0), 0)
  );

  const penaltyScore = round2(Number(profile.penalty_score) || 0);
  const carriedBalance = round2(Number(profile.carried_balance) || 0);

  const deductions = round2(
    requestedDeductions + ordersSpent + investmentsOut + refsOut + batchOut + exchangeOut
  );
  const credits_in = round2(ordersEarned + dividendsIn + refsIn + batchIn + exchangeIn);

  const total_earned = round2(score_earned + credits_in);
  const total_deductions = round2(deductions + penaltyScore);

  const raw_balance = round2(carriedBalance + total_earned - total_deductions);
  const balance = round2(Math.max(config.negative_points_floor, raw_balance));

  const upward_votes = recognitionVotes.filter(
    (v) => normUid(v.target_uid) === uidNorm && v.direction === 'UPWARD'
  ).length;
  const compensate_votes = recognitionVotes.filter(
    (v) => normUid(v.target_uid) === uidNorm && v.direction === 'COMPENSATE'
  ).length;

  return {
    universal_id: uid,
    services_given,
    hours_served: round2(hours_served),
    score_earned,
    credits_in,
    total_earned,
    services_received: receivedLogs.length,
    deductions,
    penalty_score: penaltyScore,
    total_deductions,
    carried_balance: carriedBalance,
    raw_balance,
    balance,
    average_hardship,
    service_tier: deriveServiceTier(score_earned, upward_votes),
    upward_votes,
    compensate_votes,
    today_hours: round2(today_hours),
    earning_breakdown: {
      services: score_earned,
      orders_sold: ordersEarned,
      dividends: dividendsIn,
      c2p_p2p_in: refsIn,
      batch_in: batchIn,
      exchange_in: exchangeIn,
    },
    deduction_breakdown: {
      requested_servants: requestedDeductions,
      orders_spent: ordersSpent,
      investments_out: investmentsOut,
      c2p_p2p_out: refsOut,
      batch_out: batchOut,
      exchange_escrow_out: exchangeOut,
      penalty: penaltyScore,
    },
  };
}

export function computeListingDemandCount(listingId: string, orders: Order[]): number {
  return orders.filter((o) => o.listing_id === listingId && o.order_status !== 'Rejected').length;
}

export interface RecognitionSimilarityMatch {
  otherUid: string;
  identicalPct: number;
  overlapOfTargetPct: number;
  sharedUids: string[];
  otherTotalRecognizers: number;
}

export interface RecognitionIntegrityResult {
  targetUid: string;
  totalVotes: number;
  uniqueExclusiveCount: number;
  uniquenessPct: number;
  recognizerUids: string[];
  topMatches: RecognitionSimilarityMatch[];
  highestSimilarityPct: number;
}

export function computeRecognitionIntegrity(
  targetUid: string,
  recognitionVotes: RecognitionVote[]
): RecognitionIntegrityResult {
  const normalizedTarget = targetUid.trim().toUpperCase();
  const byTarget = new Map<string, Set<string>>();
  const recognizerTargets = new Map<string, Set<string>>();

  for (const v of recognitionVotes) {
    const t = v.target_uid.trim().toUpperCase();
    const r = v.recognizer_uid.trim().toUpperCase();
    if (!byTarget.has(t)) byTarget.set(t, new Set());
    byTarget.get(t)!.add(r);
    if (!recognizerTargets.has(r)) recognizerTargets.set(r, new Set());
    recognizerTargets.get(r)!.add(t);
  }

  const targetSet = byTarget.get(normalizedTarget) || new Set<string>();
  const recognizerUids = Array.from(targetSet);
  const totalVotes = recognitionVotes.filter(
    (v) => v.target_uid.trim().toUpperCase() === normalizedTarget
  ).length;

  let uniqueExclusiveCount = 0;
  for (const rUid of recognizerUids) {
    const targetsCount = recognizerTargets.get(rUid)?.size || 0;
    if (targetsCount <= 1) uniqueExclusiveCount += 1;
  }

  const uniquenessPct =
    recognizerUids.length > 0
      ? Math.round((uniqueExclusiveCount / recognizerUids.length) * 100)
      : 100;

  const topMatches: RecognitionSimilarityMatch[] = [];
  for (const [otherUid, otherSet] of byTarget.entries()) {
    if (otherUid === normalizedTarget || otherSet.size === 0 || targetSet.size === 0) continue;
    const sharedUids = recognizerUids.filter((r) => otherSet.has(r));
    if (sharedUids.length === 0) continue;
    const unionSize = new Set([...recognizerUids, ...otherSet]).size;
    const identicalPct = Math.round((sharedUids.length / unionSize) * 100);
    const overlapOfTargetPct = Math.round((sharedUids.length / targetSet.size) * 100);
    topMatches.push({
      otherUid,
      identicalPct,
      overlapOfTargetPct,
      sharedUids,
      otherTotalRecognizers: otherSet.size,
    });
  }

  topMatches.sort((a, b) => b.identicalPct - a.identicalPct || b.sharedUids.length - a.sharedUids.length);

  return {
    targetUid: normalizedTarget,
    totalVotes,
    uniqueExclusiveCount,
    uniquenessPct,
    recognizerUids,
    topMatches,
    highestSimilarityPct: topMatches[0]?.identicalPct || 0,
  };
}

export function computeAllRecognitionFraudAlerts(
  recognitionVotes: RecognitionVote[]
): RecognitionIntegrityResult[] {
  const targets = Array.from(
    new Set(recognitionVotes.map((v) => v.target_uid.trim().toUpperCase()))
  );
  return targets
    .map((uid) => computeRecognitionIntegrity(uid, recognitionVotes))
    .sort(
      (a, b) =>
        b.highestSimilarityPct - a.highestSimilarityPct ||
        a.uniquenessPct - b.uniquenessPct ||
        b.totalVotes - a.totalVotes
    );
}

export interface ProjectInvestmentMetrics {
  totalInvested: number;
  shareCount: number;
  reportedCost: number;
  reportedIncome: number;
  realTimeListingIncome: number;
  pendingListingIncome: number;
  totalAccumulatedIncome: number;
  netPosition: number;
}

export function computeProjectInvestmentMetrics(
  projectId: string,
  listings: Listing[],
  orders: Order[],
  investments: Investment[],
  projectReports: ProjectInvestmentReport[]
): ProjectInvestmentMetrics {
  const projInvestments = investments.filter(
    (i) => (i.project_id === projectId || i.listing_id === projectId) && i.status !== 'Cancelled'
  );
  const totalInvested = Number(
    projInvestments.reduce((acc, i) => acc + i.invested_points, 0).toFixed(2)
  );
  const shareCount = projInvestments.length;

  const reports = projectReports.filter((r) => r.project_id === projectId);
  const reportedCost = Number(
    reports.reduce((acc, r) => acc + r.period_cost_points, 0).toFixed(2)
  );
  const reportedIncome = Number(
    reports.reduce((acc, r) => acc + r.period_income_points, 0).toFixed(2)
  );

  const linkedListingIds = new Set(
    listings.filter((l) => l.linked_project_id === projectId).map((l) => l.id)
  );
  const realTimeListingIncome = Number(
    orders
      .filter((o) => linkedListingIds.has(o.listing_id) && o.delivery_status === 'Delivered')
      .reduce((acc, o) => acc + o.total_points, 0)
      .toFixed(2)
  );
  const pendingListingIncome = Number(
    orders
      .filter(
        (o) =>
          linkedListingIds.has(o.listing_id) &&
          o.order_status !== 'Rejected' &&
          o.delivery_status !== 'Delivered'
      )
      .reduce((acc, o) => acc + o.total_points, 0)
      .toFixed(2)
  );

  const totalAccumulatedIncome = Number((reportedIncome + realTimeListingIncome).toFixed(2));
  const netPosition = Number((totalAccumulatedIncome - reportedCost).toFixed(2));

  return {
    totalInvested,
    shareCount,
    reportedCost,
    reportedIncome,
    realTimeListingIncome,
    pendingListingIncome,
    totalAccumulatedIncome,
    netPosition,
  };
}

export interface InvestmentChartPoint {
  label: string;
  date: string;
  invested: number;
  cost: number;
  income: number;
  net: number;
}

export function buildProjectChartSeries(
  projectId: string,
  projectCreatedAt: string,
  listings: Listing[],
  orders: Order[],
  investments: Investment[],
  projectReports: ProjectInvestmentReport[]
): InvestmentChartPoint[] {
  const projInvs = investments
    .filter(
      (i) => (i.project_id === projectId || i.listing_id === projectId) && i.status !== 'Cancelled'
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const totalInvested = projInvs.reduce((acc, i) => acc + i.invested_points, 0);

  const reports = projectReports
    .filter((r) => r.project_id === projectId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const linkedListingIds = new Set(
    listings.filter((l) => l.linked_project_id === projectId).map((l) => l.id)
  );
  const liveOrdersIncome = orders
    .filter((o) => linkedListingIds.has(o.listing_id) && o.delivery_status === 'Delivered')
    .reduce((acc, o) => acc + o.total_points, 0);

  const points: InvestmentChartPoint[] = [
    {
      label: 'Start',
      date: (projInvs[0]?.created_at || projectCreatedAt).slice(0, 10),
      invested: Number(totalInvested.toFixed(2)),
      cost: 0,
      income: 0,
      net: 0,
    },
  ];

  let cumCost = 0;
  let cumIncome = 0;

  reports.forEach((rep) => {
    cumCost = Number((cumCost + rep.period_cost_points).toFixed(2));
    cumIncome = Number((cumIncome + rep.period_income_points).toFixed(2));
    const investedAtDate = projInvs
      .filter((i) => i.created_at <= rep.created_at)
      .reduce((acc, i) => acc + i.invested_points, 0);
    points.push({
      label: rep.report_code,
      date: rep.created_at.slice(0, 10),
      invested: Number((investedAtDate || totalInvested).toFixed(2)),
      cost: cumCost,
      income: cumIncome,
      net: Number((cumIncome - cumCost).toFixed(2)),
    });
  });

  if (liveOrdersIncome > 0 || points.length === 1) {
    const finalIncome = Number((cumIncome + liveOrdersIncome).toFixed(2));
    points.push({
      label: 'Now (Live)',
      date: new Date().toISOString().slice(0, 10),
      invested: Number(totalInvested.toFixed(2)),
      cost: cumCost,
      income: finalIncome,
      net: Number((finalIncome - cumCost).toFixed(2)),
    });
  }

  return points;
}

export function buildPlatformInvestmentSeries(
  investments: Investment[],
  projectReports: ProjectInvestmentReport[],
  orders: Order[],
  listings: Listing[]
): {
  totalInvested: number;
  totalCost: number;
  totalIncome: number;
  realTimeListingIncome: number;
  points: InvestmentChartPoint[];
} {
  const activeInvs = investments.filter((i) => i.status !== 'Cancelled');
  const totalInvested = Number(
    activeInvs.reduce((acc, i) => acc + i.invested_points, 0).toFixed(2)
  );
  const totalCost = Number(
    projectReports.reduce((acc, r) => acc + r.period_cost_points, 0).toFixed(2)
  );
  const reportedIncome = Number(
    projectReports.reduce((acc, r) => acc + r.period_income_points, 0).toFixed(2)
  );

  const linkedListingIds = new Set(
    listings.filter((l) => Boolean(l.linked_project_id)).map((l) => l.id)
  );
  const linkedDeliveredOrders = orders.filter(
    (o) => linkedListingIds.has(o.listing_id) && o.delivery_status === 'Delivered'
  );
  const realTimeListingIncome = Number(
    linkedDeliveredOrders.reduce((acc, o) => acc + o.total_points, 0).toFixed(2)
  );
  const totalIncome = Number((reportedIncome + realTimeListingIncome).toFixed(2));

  type RawEvent = {
    date: string;
    label: string;
    invDelta: number;
    costDelta: number;
    incDelta: number;
  };
  const events: RawEvent[] = [];

  activeInvs.forEach((inv) => {
    events.push({
      date: inv.created_at,
      label: inv.investment_code,
      invDelta: inv.invested_points,
      costDelta: 0,
      incDelta: 0,
    });
  });

  projectReports.forEach((rep) => {
    events.push({
      date: rep.created_at,
      label: rep.report_code,
      invDelta: 0,
      costDelta: rep.period_cost_points,
      incDelta: rep.period_income_points,
    });
  });

  linkedDeliveredOrders.forEach((ord) => {
    events.push({
      date: ord.created_at,
      label: ord.order_number,
      invDelta: 0,
      costDelta: 0,
      incDelta: ord.total_points,
    });
  });

  events.sort((a, b) => a.date.localeCompare(b.date));

  const points: InvestmentChartPoint[] = [];
  if (events.length === 0) {
    return {
      totalInvested: 0,
      totalCost: 0,
      totalIncome: 0,
      realTimeListingIncome: 0,
      points: [
        {
          label: 'Platform Start',
          date: new Date().toISOString().slice(0, 10),
          invested: 0,
          cost: 0,
          income: 0,
          net: 0,
        },
      ],
    };
  }

  let runInv = 0;
  let runCost = 0;
  let runInc = 0;
  points.push({
    label: 'Origin',
    date: events[0].date.slice(0, 10),
    invested: 0,
    cost: 0,
    income: 0,
    net: 0,
  });

  events.forEach((ev) => {
    runInv = Number((runInv + ev.invDelta).toFixed(2));
    runCost = Number((runCost + ev.costDelta).toFixed(2));
    runInc = Number((runInc + ev.incDelta).toFixed(2));
    points.push({
      label: ev.label,
      date: ev.date.slice(0, 10),
      invested: runInv,
      cost: runCost,
      income: runInc,
      net: Number((runInc - runCost).toFixed(2)),
    });
  });

  return {
    totalInvested,
    totalCost,
    totalIncome,
    realTimeListingIncome,
    points,
  };
}

export interface UnifiedTransactionRecord {
  id: string;
  code: string;
  category: 'Service' | 'Deduction' | 'Order' | 'C2P' | 'P2P' | 'Batch' | 'Exchange' | 'Investment';
  role: 'Issuer / Sender' | 'Receiver / Counterparty';
  counterpartyUid: string;
  amount: number;
  direction: '+' | '-' | 'Escrow';
  status: string;
  summary: string;
  created_at: string;
}

export function buildUidUnifiedTransactions(
  uid: string,
  data: {
    serviceLogs: ServiceLog[];
    deductionLogs: RequestedServantLog[];
    orders: Order[];
    investments: Investment[];
    transactionRefs: TransactionRef[];
    batchPayments: BatchPayment[];
    pointExchanges: PointExchange[];
  }
): UnifiedTransactionRecord[] {
  const normalized = normUid(uid);
  if (!normalized) return [];

  const orderById = new Map(data.orders.map((o) => [o.id, o]));
  const rows: UnifiedTransactionRecord[] = [];

  for (const l of data.serviceLogs) {
    if (normUid(l.provider_uid) === normalized) {
      rows.push({
        id: `srv_p_${l.id}`,
        code: l.log_number,
        category: 'Service',
        role: 'Issuer / Sender',
        counterpartyUid: l.recipient_uid,
        amount: l.final_score,
        direction: '+',
        status: 'Recorded',
        summary: `Served: ${l.service_type} (${l.hours}h × H${l.hardship})`,
        created_at: l.created_at,
      });
    }
    if (normUid(l.recipient_uid) === normalized) {
      rows.push({
        id: `srv_r_${l.id}`,
        code: l.log_number,
        category: 'Service',
        role: 'Receiver / Counterparty',
        counterpartyUid: l.provider_uid,
        amount: l.final_score,
        direction: 'Escrow',
        status: 'Received',
        summary: `Received: ${l.service_type} (${l.hours}h × H${l.hardship})`,
        created_at: l.created_at,
      });
    }
  }

  for (const d of data.deductionLogs) {
    if (normUid(d.requester_uid) === normalized) {
      rows.push({
        id: `ded_i_${d.id}`,
        code: d.request_number,
        category: 'Deduction',
        role: 'Issuer / Sender',
        counterpartyUid: d.requested_servant_uid,
        amount: d.deducted_score,
        direction: 'Escrow',
        status: d.status,
        summary: `Requested servant deduction${d.related_service_log_id ? ` (${d.related_service_log_id})` : ''}`,
        created_at: d.created_at,
      });
    }
    if (normUid(d.requested_servant_uid) === normalized) {
      rows.push({
        id: `ded_r_${d.id}`,
        code: d.request_number,
        category: 'Deduction',
        role: 'Receiver / Counterparty',
        counterpartyUid: d.requester_uid,
        amount: d.deducted_score,
        direction: d.status === 'Disputed' ? 'Escrow' : '-',
        status: d.status,
        summary: d.status === 'Disputed' ? 'Servant deduction (Disputed)' : 'Servant deduction recorded',
        created_at: d.created_at,
      });
    }
  }

  for (const o of data.orders) {
    const isRejected = o.order_status === 'Rejected' || o.delivery_status === 'Rejected';
    if (normUid(o.buyer_uid) === normalized) {
      rows.push({
        id: `ord_b_${o.id}`,
        code: o.order_number,
        category: 'Order',
        role: 'Issuer / Sender',
        counterpartyUid: o.seller_uid,
        amount: o.total_points,
        direction: isRejected ? 'Escrow' : '-',
        status: `${o.order_status} · ${o.delivery_status}`,
        summary: `Order ${o.listing_code} × ${o.quantity}${o.c2p_ref_code ? ` · ${o.c2p_ref_code}` : ''}`,
        created_at: o.created_at,
      });
    }
    if (normUid(o.seller_uid) === normalized) {
      rows.push({
        id: `ord_s_${o.id}`,
        code: o.order_number,
        category: 'Order',
        role: 'Receiver / Counterparty',
        counterpartyUid: o.buyer_uid,
        amount: o.total_points,
        direction: !isRejected && o.delivery_status === 'Delivered' ? '+' : 'Escrow',
        status: `${o.order_status} · ${o.delivery_status}`,
        summary: `Sale ${o.listing_code} × ${o.quantity}${o.c2p_ref_code ? ` · ${o.c2p_ref_code}` : ''}`,
        created_at: o.created_at,
      });
    }
  }

  for (const r of data.transactionRefs) {
    if (r.ref_type === 'P2P') {
      if (normUid(r.issuer_uid) === normalized) {
        rows.push({
          id: `ref_i_${r.id}`,
          code: r.ref_code,
          category: 'P2P',
          role: 'Issuer / Sender',
          counterpartyUid: r.counterparty_uid || 'OPEN',
          amount: r.points_amount,
          direction: r.status === 'Confirmed' ? '-' : 'Escrow',
          status: r.status,
          summary: r.description || `P2P Ref (${r.trigger_type})`,
          created_at: r.created_at,
        });
      }
      if (normUid(r.counterparty_uid) === normalized) {
        rows.push({
          id: `ref_c_${r.id}`,
          code: r.ref_code,
          category: 'P2P',
          role: 'Receiver / Counterparty',
          counterpartyUid: r.issuer_uid,
          amount: r.points_amount,
          direction: r.status === 'Confirmed' ? '+' : 'Escrow',
          status: r.status,
          summary: r.description || `P2P Transfer Received`,
          created_at: r.confirmed_at || r.created_at,
        });
      }
    } else {
      const settlements = r.c2p_settlements || [];
      if (settlements.length > 0) {
        settlements.forEach((s, idx) => {
          const linkedOrd =
            (s.order_id ? orderById.get(s.order_id) : undefined) ||
            (!s.order_id && r.linked_order_id ? orderById.get(r.linked_order_id) : undefined) ||
            (!s.order_id
              ? data.orders.find(
                  (o) =>
                    o.c2p_ref_code === r.ref_code &&
                    normUid(o.buyer_uid) === normUid(s.payer_uid) &&
                    Math.abs((Number(o.total_points) || 0) - (Number(s.points_amount) || 0)) < 0.01
                )
              : undefined);
          if (normUid(r.issuer_uid) === normalized) {
            rows.push({
              id: `c2p_i_${r.id}_${idx}`,
              code: r.ref_code,
              category: 'C2P',
              role: 'Receiver / Counterparty',
              counterpartyUid: s.payer_uid,
              amount: s.points_amount,
              direction: linkedOrd ? 'Escrow' : '+',
              status: linkedOrd
                ? `Via ${linkedOrd.order_number} · ${linkedOrd.delivery_status}`
                : `${r.status} · Settlement #${idx + 1}`,
              summary: `${r.widget_name || 'C2P Widget'}${linkedOrd ? ` · Counted under ${linkedOrd.order_number}` : ''}`,
              created_at: s.paid_at,
            });
          }
          if (normUid(s.payer_uid) === normalized) {
            rows.push({
              id: `c2p_p_${r.id}_${idx}`,
              code: r.ref_code,
              category: 'C2P',
              role: 'Issuer / Sender',
              counterpartyUid: r.issuer_uid,
              amount: s.points_amount,
              direction: linkedOrd ? 'Escrow' : '-',
              status: linkedOrd ? `Via ${linkedOrd.order_number}` : `Paid · ${r.status}`,
              summary: `${r.widget_name || 'C2P Checkout'}${linkedOrd ? ` · Counted under ${linkedOrd.order_number}` : ''}`,
              created_at: s.paid_at,
            });
          }
        });
      } else {
        const linkedLegacyOrd =
          (r.linked_order_id ? orderById.get(r.linked_order_id) : undefined) ||
          data.orders.find((o) => o.c2p_ref_code === r.ref_code);
        if (normUid(r.issuer_uid) === normalized) {
          rows.push({
            id: `c2p_open_${r.id}`,
            code: r.ref_code,
            category: 'C2P',
            role: 'Receiver / Counterparty',
            counterpartyUid: r.counterparty_uid || 'ANY PAYER',
            amount: r.points_amount,
            direction: r.status === 'Confirmed' && !linkedLegacyOrd ? '+' : 'Escrow',
            status: linkedLegacyOrd ? `Via ${linkedLegacyOrd.order_number}` : r.status,
            summary: r.widget_name || r.description || 'C2P Checkout Widget',
            created_at: r.created_at,
          });
        }
        if (normUid(r.counterparty_uid) === normalized) {
          rows.push({
            id: `c2p_pay_${r.id}`,
            code: r.ref_code,
            category: 'C2P',
            role: 'Issuer / Sender',
            counterpartyUid: r.issuer_uid,
            amount: r.points_amount,
            direction: r.status === 'Confirmed' && !linkedLegacyOrd ? '-' : 'Escrow',
            status: linkedLegacyOrd ? `Via ${linkedLegacyOrd.order_number}` : r.status,
            summary: r.widget_name || r.description || 'C2P Checkout',
            created_at: r.confirmed_at || r.created_at,
          });
        }
      }
    }
  }

  for (const b of data.batchPayments) {
    const isFeePool = b.funding_source === 'PLATFORM_FEES';
    const totalBatch =
      b.recipients.reduce((acc, r) => acc + (Number(r.points) || 0), 0) * Math.max(1, b.send_count);
    if (normUid(b.creator_uid) === normalized && b.send_count > 0) {
      rows.push({
        id: `bat_s_${b.id}`,
        code: b.batch_code,
        category: 'Batch',
        role: 'Issuer / Sender',
        counterpartyUid: `${b.recipients.length} UIDs`,
        amount: round2(totalBatch),
        direction: isFeePool ? 'Escrow' : '-',
        status: `${isFeePool ? 'Fee Pool · ' : ''}${b.status} (${b.send_count}×)`,
        summary: isFeePool ? `Platform Fee Pool: ${b.batch_name}` : b.batch_name,
        created_at: b.last_sent_at || b.created_at,
      });
    }
    if (b.send_count > 0) {
      b.recipients.forEach((rec, idx) => {
        if (normUid(rec.uid) === normalized) {
          rows.push({
            id: `bat_r_${b.id}_${idx}`,
            code: b.batch_code,
            category: 'Batch',
            role: 'Receiver / Counterparty',
            counterpartyUid: isFeePool ? 'PLATFORM-FEES' : b.creator_uid,
            amount: round2((Number(rec.points) || 0) * b.send_count),
            direction: '+',
            status: `${isFeePool ? 'Fee Pool · ' : ''}${b.status} (${b.send_count}×)`,
            summary: `${b.batch_name}${rec.note ? ` · ${rec.note}` : ''}`,
            created_at: b.last_sent_at || b.created_at,
          });
        }
      });
    }
  }

  for (const e of data.pointExchanges) {
    const sellerDeducted =
      e.status === 'Escrow Locked' || e.status === 'Proof Submitted' || e.status === 'Released';
    if (normUid(e.seller_uid) === normalized) {
      rows.push({
        id: `exc_s_${e.id}`,
        code: e.exchange_code,
        category: 'Exchange',
        role: 'Issuer / Sender',
        counterpartyUid: e.buyer_uid || 'OPEN',
        amount: e.points_requested,
        direction: sellerDeducted ? '-' : 'Escrow',
        status: e.status,
        summary: `${e.points_requested} pts ↔ ${e.cash_amount} ${e.currency}`,
        created_at: e.created_at,
      });
    }
    if (normUid(e.buyer_uid) === normalized) {
      rows.push({
        id: `exc_b_${e.id}`,
        code: e.exchange_code,
        category: 'Exchange',
        role: 'Receiver / Counterparty',
        counterpartyUid: e.seller_uid,
        amount: e.points_requested,
        direction: e.status === 'Released' ? '+' : 'Escrow',
        status: e.status,
        summary: `${e.points_requested} pts ↔ ${e.cash_amount} ${e.currency}`,
        created_at: e.created_at,
      });
    }
  }

  for (const inv of data.investments) {
    if (normUid(inv.investor_uid) === normalized) {
      rows.push({
        id: `inv_${inv.id}`,
        code: inv.investment_code,
        category: 'Investment',
        role: 'Issuer / Sender',
        counterpartyUid: inv.project_code || inv.listing_code,
        amount: inv.invested_points,
        direction: inv.status === 'Cancelled' ? 'Escrow' : '-',
        status: `${inv.status} (${inv.share_percentage}%)`,
        summary: `Project investment · Principal locked`,
        created_at: inv.created_at,
      });
      if ((Number(inv.dividends_earned) || 0) > 0) {
        rows.push({
          id: `div_${inv.id}`,
          code: inv.investment_code,
          category: 'Investment',
          role: 'Receiver / Counterparty',
          counterpartyUid: inv.project_code || inv.listing_code,
          amount: inv.dividends_earned,
          direction: '+',
          status: 'Dividend Earned',
          summary: `Shareholder dividend payout (${inv.share_percentage}% share)`,
          created_at: inv.created_at,
        });
      }
    }
  }

  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function sha256Hex(input: string): Promise<string> {
  const normalized = input.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
