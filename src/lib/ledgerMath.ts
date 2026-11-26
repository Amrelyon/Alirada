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

export function isC2POrderConnectedRef(r: TransactionRef): boolean {
  return (
    r.ref_type === 'C2P' &&
    (Boolean(r.linked_listing_code) ||
      r.trigger_type === 'Order Creation' ||
      Boolean(r.linked_order_id))
  );
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

  // P2P settles directly via status === 'Confirmed'.
  // C2P connected to a listing/order settles through Orders (never double-counted here).
  // Standalone C2P settles via c2p_settlements[] (or fallback to Confirmed if no settlements array).
  let refsOut = 0;
  let refsIn = 0;

  for (const r of transactionRefs) {
    if (r.ref_type === 'P2P') {
      if (r.status === 'Confirmed') {
        if (r.issuer_uid === uid) refsOut += r.points_amount;
        if (r.counterparty_uid === uid) refsIn += r.points_amount;
      }
      continue;
    }

    if (isC2POrderConnectedRef(r)) {
      // Settled strictly via linked Order records to avoid double deduction
      continue;
    }

    const settlements = r.c2p_settlements || [];
    if (settlements.length > 0) {
      for (const s of settlements) {
        if (s.payer_uid === uid) refsOut += s.points_amount;
        if (r.issuer_uid === uid) refsIn += s.points_amount;
      }
    } else if (r.status === 'Confirmed') {
      if (r.counterparty_uid === uid) refsOut += r.points_amount;
      if (r.issuer_uid === uid) refsIn += r.points_amount;
    }
  }

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

  // Deactivated or Cancelled exchanges release escrow back to seller
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
  const normalized = uid.trim().toUpperCase();
  if (!normalized) return [];

  const rows: UnifiedTransactionRecord[] = [];

  for (const l of data.serviceLogs) {
    if (l.provider_uid.toUpperCase() === normalized) {
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
    if (l.recipient_uid.toUpperCase() === normalized) {
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
    if (d.requester_uid.toUpperCase() === normalized) {
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
    if (d.requested_servant_uid.toUpperCase() === normalized) {
      rows.push({
        id: `ded_r_${d.id}`,
        code: d.request_number,
        category: 'Deduction',
        role: 'Receiver / Counterparty',
        counterpartyUid: d.requester_uid,
        amount: d.deducted_score,
        direction: '-',
        status: d.status,
        summary: `Servant deduction recorded`,
        created_at: d.created_at,
      });
    }
  }

  for (const o of data.orders) {
    if (o.buyer_uid.toUpperCase() === normalized) {
      rows.push({
        id: `ord_b_${o.id}`,
        code: o.order_number,
        category: 'Order',
        role: 'Issuer / Sender',
        counterpartyUid: o.seller_uid,
        amount: o.total_points,
        direction: o.order_status === 'Rejected' ? 'Escrow' : '-',
        status: `${o.order_status} · ${o.delivery_status}`,
        summary: `Order ${o.listing_code} × ${o.quantity}${o.c2p_ref_code ? ` · ${o.c2p_ref_code}` : ''}`,
        created_at: o.created_at,
      });
    }
    if (o.seller_uid.toUpperCase() === normalized) {
      rows.push({
        id: `ord_s_${o.id}`,
        code: o.order_number,
        category: 'Order',
        role: 'Receiver / Counterparty',
        counterpartyUid: o.buyer_uid,
        amount: o.total_points,
        direction: o.delivery_status === 'Delivered' ? '+' : 'Escrow',
        status: `${o.order_status} · ${o.delivery_status}`,
        summary: `Sale ${o.listing_code} × ${o.quantity}${o.c2p_ref_code ? ` · ${o.c2p_ref_code}` : ''}`,
        created_at: o.created_at,
      });
    }
  }

  for (const r of data.transactionRefs) {
    if (r.ref_type === 'P2P') {
      if (r.issuer_uid.toUpperCase() === normalized) {
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
      if (r.counterparty_uid?.toUpperCase() === normalized) {
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
          if (r.issuer_uid.toUpperCase() === normalized) {
            rows.push({
              id: `c2p_i_${r.id}_${idx}`,
              code: r.ref_code,
              category: 'C2P',
              role: 'Receiver / Counterparty',
              counterpartyUid: s.payer_uid,
              amount: s.points_amount,
              direction: '+',
              status: `${r.status} · Settlement #${idx + 1}`,
              summary: `${r.widget_name || 'C2P Widget'}${s.order_number ? ` · ${s.order_number}` : ''}`,
              created_at: s.paid_at,
            });
          }
          if (s.payer_uid.toUpperCase() === normalized) {
            rows.push({
              id: `c2p_p_${r.id}_${idx}`,
              code: r.ref_code,
              category: 'C2P',
              role: 'Issuer / Sender',
              counterpartyUid: r.issuer_uid,
              amount: s.points_amount,
              direction: '-',
              status: `Paid · ${r.status}`,
              summary: `${r.widget_name || 'C2P Checkout'}${s.order_number ? ` · ${s.order_number}` : ''}`,
              created_at: s.paid_at,
            });
          }
        });
      } else {
        if (r.issuer_uid.toUpperCase() === normalized) {
          rows.push({
            id: `c2p_open_${r.id}`,
            code: r.ref_code,
            category: 'C2P',
            role: 'Receiver / Counterparty',
            counterpartyUid: r.counterparty_uid || 'ANY PAYER',
            amount: r.points_amount,
            direction: r.status === 'Confirmed' ? '+' : 'Escrow',
            status: r.status,
            summary: r.widget_name || r.description || 'C2P Checkout Widget',
            created_at: r.created_at,
          });
        }
        if (r.counterparty_uid?.toUpperCase() === normalized) {
          rows.push({
            id: `c2p_pay_${r.id}`,
            code: r.ref_code,
            category: 'C2P',
            role: 'Issuer / Sender',
            counterpartyUid: r.issuer_uid,
            amount: r.points_amount,
            direction: r.status === 'Confirmed' ? '-' : 'Escrow',
            status: r.status,
            summary: r.widget_name || r.description || 'C2P Checkout',
            created_at: r.confirmed_at || r.created_at,
          });
        }
      }
    }
  }

  for (const b of data.batchPayments) {
    const totalBatch = b.recipients.reduce((acc, r) => acc + r.points, 0) * Math.max(1, b.send_count);
    if (b.creator_uid.toUpperCase() === normalized && b.send_count > 0) {
      rows.push({
        id: `bat_s_${b.id}`,
        code: b.batch_code,
        category: 'Batch',
        role: 'Issuer / Sender',
        counterpartyUid: `${b.recipients.length} UIDs`,
        amount: totalBatch,
        direction: '-',
        status: `${b.status} (${b.send_count}×)`,
        summary: b.batch_name,
        created_at: b.last_sent_at || b.created_at,
      });
    }
    if (b.send_count > 0) {
      b.recipients.forEach((rec, idx) => {
        if (rec.uid.toUpperCase() === normalized) {
          rows.push({
            id: `bat_r_${b.id}_${idx}`,
            code: b.batch_code,
            category: 'Batch',
            role: 'Receiver / Counterparty',
            counterpartyUid: b.creator_uid,
            amount: rec.points * b.send_count,
            direction: '+',
            status: `${b.status} (${b.send_count}×)`,
            summary: `${b.batch_name}${rec.note ? ` · ${rec.note}` : ''}`,
            created_at: b.last_sent_at || b.created_at,
          });
        }
      });
    }
  }

  for (const e of data.pointExchanges) {
    if (e.seller_uid.toUpperCase() === normalized) {
      rows.push({
        id: `exc_s_${e.id}`,
        code: e.exchange_code,
        category: 'Exchange',
        role: 'Issuer / Sender',
        counterpartyUid: e.buyer_uid || 'OPEN',
        amount: e.points_requested,
        direction: e.status === 'Released' ? '-' : 'Escrow',
        status: e.status,
        summary: `${e.points_requested} pts ↔ ${e.cash_amount} ${e.currency}`,
        created_at: e.created_at,
      });
    }
    if (e.buyer_uid?.toUpperCase() === normalized) {
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
    if (inv.investor_uid.toUpperCase() === normalized) {
      rows.push({
        id: `inv_${inv.id}`,
        code: inv.investment_code,
        category: 'Investment',
        role: 'Issuer / Sender',
        counterpartyUid: inv.project_code || inv.listing_code,
        amount: inv.invested_points,
        direction: inv.status === 'Cancelled' ? 'Escrow' : '-',
        status: `${inv.status} (${inv.share_percentage}%)`,
        summary: `Project investment · Dividends: +${inv.dividends_earned} pts`,
        created_at: inv.created_at,
      });
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
