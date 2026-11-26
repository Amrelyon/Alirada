import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth as firebaseAuth,
  createUserWithEmailAndPassword,
  db as firebaseDb,
  googleAuthProvider,
  handleFirestoreError,
  isFirebaseConfigured,
  OperationType,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  testConnection,
} from '../lib/firebase';
import {
  DEFAULT_SYSTEM_CONFIG,
  SEED_BATCH_PAYMENTS,
  SEED_DEDUCTION_LOGS,
  SEED_EMPLOYMENT,
  SEED_GOVERNANCE,
  SEED_HIERARCHY_ITEMS,
  SEED_INVESTMENTS,
  SEED_LISTINGS,
  SEED_ORDERS,
  SEED_POINT_EXCHANGES,
  SEED_PROFILES,
  SEED_PROJECTS,
  SEED_PROJECT_REPORTS,
  SEED_RECOGNITION_VOTES,
  SEED_SERVICE_LOGS,
  SEED_TRANSACTION_REFS,
} from '../data/masterData';
import {
  AdminDelegate,
  AliradaProfile,
  BatchPayment,
  BatchRecipient,
  C2PSettlementRecord,
  Delivery,
  EmploymentPosting,
  EntityType,
  GovernanceDelegate,
  Investment,
  LedgerMetrics,
  LegacyBeneficiary,
  Listing,
  Order,
  PaymentModel,
  PlatformNotification,
  PointExchange,
  Project,
  ProjectHierarchyItem,
  ProjectInvestmentReport,
  ProjectInvestmentReportLink,
  RecognitionVote,
  RequestedServantLog,
  ServiceLog,
  SystemConfigState,
  TransactionRef,
  TriggerType,
  UserReport,
} from '../types/alirada';
import { computeUserLedgerMetrics, sha256Hex } from '../lib/ledgerMath';
import { sanitizeExternalLink } from '../lib/mediaUtils';

export const ROOT_ADMIN_EMAIL = 'amrelyon@gmail.com';

export type AppSection =
  | 'home'
  | 'ledger'
  | 'marketplace'
  | 'projects'
  | 'payments'
  | 'governance'
  | 'admin';

interface ToastMessage {
  id: string;
  kind: 'success' | 'warning' | 'error';
  text: string;
}

export function getEffectiveListingAvailability(
  listing: Listing,
  _investments?: Investment[]
): 'Active' | 'Deactivated' {
  if (listing.is_deactivated || listing.availability_status === 'Deactivated') {
    return 'Deactivated';
  }
  return 'Active';
}

interface AliradaContextValue {
  firebaseUser: User | null;
  authReady: boolean;
  isFirebaseConfigured: boolean;
  isLiveFirestore: boolean;
  isRootAdmin: boolean;
  isAdmin: boolean;
  adminDelegates: AdminDelegate[];
  myDelegatedTasks: string[];
  mockDataCleared: boolean;
  mockRecordCount: number;
  currentProfile: AliradaProfile;
  profiles: AliradaProfile[];
  metricsMap: Record<string, LedgerMetrics>;
  serviceLogs: ServiceLog[];
  deductionLogs: RequestedServantLog[];
  recognitionVotes: RecognitionVote[];
  listings: Listing[];
  projects: Project[];
  hierarchyItems: ProjectHierarchyItem[];
  employmentPostings: EmploymentPosting[];
  orders: Order[];
  deliveries: Delivery[];
  investments: Investment[];
  projectReports: ProjectInvestmentReport[];
  pointExchanges: PointExchange[];
  transactionRefs: TransactionRef[];
  batchPayments: BatchPayment[];
  governanceDelegates: GovernanceDelegate[];
  userReports: UserReport[];
  notifications: PlatformNotification[];
  systemConfig: SystemConfigState;
  activeSection: AppSection;
  setActiveSection: (s: AppSection) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  inspectedUid: string | null;
  setInspectedUid: (uid: string | null) => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  reportModalTarget: { type: UserReport['target_type']; id: string } | null;
  setReportModalTarget: (t: { type: UserReport['target_type']; id: string } | null) => void;
  activeCheckoutRefCode: string | null;
  setActiveCheckoutRefCode: (code: string | null) => void;
  toasts: ToastMessage[];
  pushToast: (kind: ToastMessage['kind'], text: string) => void;
  dismissToast: (id: string) => void;
  pendingPayRef: string;
  clearPendingPayRef: () => void;
  // Auth methods
  signInWithGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (
    email: string,
    password: string,
    fullName: string,
    entityType: EntityType,
    avatarUrl: string,
    securityQuestion: string,
    securityAnswer: string
  ) => Promise<void>;
  recoverViaSecurityQuestion: (
    email: string,
    answer: string
  ) => Promise<{ verified: boolean; message: string }>;
  signOutUser: () => Promise<void>;
  updateOwnProfile: (patch: Partial<AliradaProfile>) => Promise<boolean>;
  saveLegacyProtocol: (
    absentDays: number,
    successorEmail: string,
    beneficiaries: LegacyBeneficiary[]
  ) => Promise<void>;
  // Economy Actions
  logService: (payload: {
    recipient_uid: string;
    service_type: string;
    hours: number;
    hardship: number;
    logged_date: string;
    project_context?: string;
    evidence_link?: string;
    google_map_link?: string;
    notes?: string;
  }) => Promise<boolean>;
  logRequestedServant: (payload: {
    requested_servant_uid: string;
    related_service_log_id?: string;
    deducted_score: number;
    logged_date: string;
    evidence_link?: string;
    notes?: string;
  }) => Promise<boolean>;
  castRecognitionVote: (
    targetUid: string,
    direction: 'UPWARD' | 'COMPENSATE',
    comment: string
  ) => Promise<boolean>;
  replyToRecognition: (voteId: string, replyText: string) => Promise<boolean>;
  // Marketplace & Project Investments
  createListing: (payload: Omit<Listing, 'id' | 'listing_code' | 'owner_uid' | 'owner_auth_uid' | 'obligation_status' | 'created_at'>) => Promise<boolean>;
  updateListing: (id: string, patch: Partial<Listing>) => Promise<boolean>;
  deactivateListing: (listingId: string, deactivated: boolean) => Promise<boolean>;
  deleteListing: (id: string) => Promise<boolean>;
  activateListingForOrders: (listingId: string) => Promise<boolean>;
  placeOrder: (payload: {
    listing: Listing;
    quantity: number;
    google_map_link?: string;
    notes?: string;
    c2p_ref_code?: string;
    c2p_payment_link?: string;
    trigger_type?: string;
    trigger_payload?: string;
  }) => Promise<Order | null>;
  confirmOrderDelivery: (payload: {
    order: Order;
    status: 'Delivered' | 'Partially Delivered' | 'Rejected';
    evidence?: string;
    notes?: string;
    rejection_reason?: string;
  }) => Promise<boolean>;
  investInProject: (project: Project, amountPoints: number) => Promise<boolean>;
  updateProjectInvestmentConfig: (
    projectId: string,
    patch: {
      investment_goal_points?: number;
      budget_doc_url?: string;
      presentation_url?: string;
      investment_status?: 'Open' | 'Deactivated' | 'Closed';
    }
  ) => Promise<boolean>;
  submitProjectInvestmentReport: (payload: {
    project: Project;
    title: string;
    summary_text: string;
    links: ProjectInvestmentReportLink[];
    period_cost_points: number;
    period_income_points: number;
  }) => Promise<boolean>;
  // Projects & Employment
  createProject: (payload: {
    name: string;
    category: string;
    description: string;
    visibility: 'Public' | 'Private';
    location?: string;
    google_map_link?: string;
    contact_info?: string;
    investment_goal_points?: number;
    budget_doc_url?: string;
    presentation_url?: string;
  }) => Promise<boolean>;
  joinOrRequestProject: (project: Project) => Promise<boolean>;
  approveProjectMember: (projectId: string, applicantUid: string) => Promise<void>;
  addHierarchyItem: (payload: {
    project_id: string;
    function_name: string;
    step_title?: string;
    fix_title?: string;
    description?: string;
    estimated_cost?: number;
    doc_url?: string;
    video_url?: string;
    image_url?: string;
  }) => Promise<boolean>;
  voteHierarchyItem: (itemId: string, vote: 'Agree' | 'Disagree') => Promise<void>;
  assignHierarchyUids: (itemId: string, uids: string[]) => Promise<void>;
  submitExecutionReport: (
    item: ProjectHierarchyItem,
    project: Project,
    hoursSpent: number,
    hardshipRating: number,
    summary: string
  ) => Promise<boolean>;
  createJobPosting: (payload: {
    project_id: string;
    position_title: string;
    qualifications: string;
    tasks_summary: string;
    required_course_ids: string[];
    location: string;
  }) => Promise<boolean>;
  applyToJob: (jobId: string, contactNumber: string, cvLink: string) => Promise<boolean>;
  inviteToJob: (jobId: string, targetUid: string) => Promise<void>;
  updateJobApplicantStatus: (
    jobId: string,
    applicantUid: string,
    status: 'Shortlisted' | 'Accepted' | 'Declined'
  ) => Promise<boolean>;
  // Payments, Batches & Point Exchange
  issueTransactionRef: (payload: {
    ref_type: 'P2P' | 'C2P';
    points_amount: number;
    payment_model: PaymentModel;
    end_date?: string;
    linked_listing_code?: string;
    widget_name?: string;
    description?: string;
    trigger_type: TriggerType;
    trigger_payload?: string;
  }) => Promise<TransactionRef | null>;
  redeemTransactionRef: (
    refCode: string,
    quantity?: number,
    orderDetails?: { google_map_link?: string; notes?: string }
  ) => Promise<{
    ok: boolean;
    ref?: TransactionRef;
    order?: Order;
    settledPoints?: number;
    triggerExecuted?: { type: string; payload?: string };
    message: string;
  }>;
  deactivateTransactionRef: (id: string, nextStatus: 'Deactivated' | 'Cancelled') => Promise<boolean>;
  deleteTransactionRef: (id: string) => Promise<boolean>;
  saveBatchPayment: (payload: {
    id?: string;
    batch_name: string;
    recipients: BatchRecipient[];
    scheduled_time?: string;
    recurrence: 'Once' | 'Weekly' | 'Monthly';
    notes?: string;
  }) => Promise<boolean>;
  sendBatchPayment: (batchId: string) => Promise<boolean>;
  deleteBatchPayment: (batchId: string) => Promise<boolean>;
  createPointExchange: (pointsRequested: number, cashAmount: number, currency: string, notes?: string) => Promise<boolean>;
  submitExchangeProof: (exchangeId: string, paymentProof: string) => Promise<boolean>;
  releasePointExchange: (exchangeId: string) => Promise<boolean>;
  deactivatePointExchange: (exchangeId: string) => Promise<boolean>;
  cancelPointExchange: (exchangeId: string) => Promise<boolean>;
  // Governance & Reports & Admin
  saveGovernanceDelegate: (payload: {
    scope: 'INSTITUTIONAL' | 'PLATFORM';
    entity_name: string;
    delegate_email: string;
    delegate_uid?: string;
    delegated_tasks: string[];
    successor_email?: string;
    absent_period_days: number;
  }) => Promise<boolean>;
  voteForCeo: (governanceId: string, candidateUid: string) => Promise<void>;
  submitUserReport: (
    targetType: UserReport['target_type'],
    targetId: string,
    reason: string,
    options?: { reportedUid?: string; snapshot?: string }
  ) => Promise<boolean>;
  resolveUserReport: (
    reportId: string,
    status: UserReport['status'],
    adminComment?: string,
    actionTaken?: string
  ) => Promise<void>;
  updateSystemConfig: (patch: Partial<SystemConfigState>) => Promise<void>;
  applyAdminDiscipline: (
    targetProfileId: string,
    action: 'PENALTY' | 'FREEZE' | 'LEGAL_BLOCK' | 'RESTORE',
    penaltyPoints?: number,
    reason?: string
  ) => Promise<void>;
  runDailyMicroFeeCycle: () => Promise<void>;
  approveCharityGrant: (
    targetProfileId: string,
    grantType: 'One-Time' | 'Monthly',
    amountPoints: number
  ) => Promise<void>;
  archiveCurrentCycle: (nextCycleName: string) => Promise<void>;
  grantAdminDelegation: (delegateEmail: string, delegateUid: string, tasks: string[]) => Promise<boolean>;
  revokeAdminDelegation: (delegateId: string) => Promise<boolean>;
  deleteMockData: () => Promise<boolean>;
  markNotificationRead: (id: string) => Promise<void>;
}

const AliradaContext = createContext<AliradaContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function mergeById<T extends { id: string }>(live: T[], seed: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of seed) map.set(item.id, item);
  for (const item of live) map.set(item.id, item);
  return Array.from(map.values());
}

const GUEST_PROFILE: AliradaProfile = {
  id: 'guest',
  uid: 'guest',
  universal_id: 'GUEST',
  full_name: 'Guest Visitor',
  entity_type: 'Individual',
  country: '',
  city: '',
  profile_image_url: '/src/assets/images/avatar_member_portrait_1795619024258.jpg',
  image_verified_status: 'Pending',
  user_status: 'Active',
  penalty_score: 0,
  carried_balance: 0,
  absent_period_days: 365,
  created_at: '2026-01-01T00:00:00Z',
};

const SEED_IDS = {
  profiles: new Set(SEED_PROFILES.map((x) => x.id)),
  serviceLogs: new Set(SEED_SERVICE_LOGS.map((x) => x.id)),
  deductions: new Set(SEED_DEDUCTION_LOGS.map((x) => x.id)),
  votes: new Set(SEED_RECOGNITION_VOTES.map((x) => x.id)),
  listings: new Set(SEED_LISTINGS.map((x) => x.id)),
  projects: new Set(SEED_PROJECTS.map((x) => x.id)),
  hierarchy: new Set(SEED_HIERARCHY_ITEMS.map((x) => x.id)),
  jobs: new Set(SEED_EMPLOYMENT.map((x) => x.id)),
  orders: new Set(SEED_ORDERS.map((x) => x.id)),
  investments: new Set(SEED_INVESTMENTS.map((x) => x.id)),
  projectReports: new Set(SEED_PROJECT_REPORTS.map((x) => x.id)),
  exchanges: new Set(SEED_POINT_EXCHANGES.map((x) => x.id)),
  refs: new Set(SEED_TRANSACTION_REFS.map((x) => x.id)),
  batches: new Set(SEED_BATCH_PAYMENTS.map((x) => x.id)),
  gov: new Set(SEED_GOVERNANCE.map((x) => x.id)),
  notifs: new Set(['notif_seed_1']),
};

function mergeProfilesByUid(live: AliradaProfile[], seed: AliradaProfile[]): AliradaProfile[] {
  const byUniversalId = new Map<string, AliradaProfile>();
  for (const item of seed) byUniversalId.set(item.universal_id, item);
  for (const item of live) byUniversalId.set(item.universal_id, item);
  return Array.from(byUniversalId.values());
}

export const AliradaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [activeSection, setActiveSection] = useState<AppSection>('home');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [inspectedUid, setInspectedUid] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [reportModalTarget, setReportModalTarget] = useState<{
    type: UserReport['target_type'];
    id: string;
  } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [pendingPayRef, setPendingPayRef] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('pay_ref');
      return param ? param.trim().toUpperCase() : '';
    }
    return '';
  });
  const [activeCheckoutRefCode, setActiveCheckoutRefCode] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('pay_ref');
      return param ? param.trim().toUpperCase() : null;
    }
    return null;
  });

  useEffect(() => {
    if (pendingPayRef) {
      setActiveCheckoutRefCode(pendingPayRef);
    }
  }, [pendingPayRef]);

  const clearPendingPayRef = () => {
    setPendingPayRef('');
    if (typeof window !== 'undefined' && window.location.search.includes('pay_ref=')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('pay_ref');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  };

  // Local state backed by Firestore when signed in & verified
  const [liveProfiles, setLiveProfiles] = useState<AliradaProfile[]>([]);
  const [privateProfileMap, setPrivateProfileMap] = useState<Record<string, Partial<AliradaProfile>>>({});
  const [localProfiles, setLocalProfiles] = useState<AliradaProfile[]>(SEED_PROFILES);

  const [liveServiceLogs, setLiveServiceLogs] = useState<ServiceLog[]>([]);
  const [localServiceLogs, setLocalServiceLogs] = useState<ServiceLog[]>(SEED_SERVICE_LOGS);

  const [liveDeductionLogs, setLiveDeductionLogs] = useState<RequestedServantLog[]>([]);
  const [localDeductionLogs, setLocalDeductionLogs] = useState<RequestedServantLog[]>(SEED_DEDUCTION_LOGS);

  const [liveVotes, setLiveVotes] = useState<RecognitionVote[]>([]);
  const [localVotes, setLocalVotes] = useState<RecognitionVote[]>(SEED_RECOGNITION_VOTES);

  const [liveListings, setLiveListings] = useState<Listing[]>([]);
  const [localListings, setLocalListings] = useState<Listing[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('alirada_activated_seed_listings') : null;
      if (raw) {
        const ids = new Set<string>(JSON.parse(raw));
        return SEED_LISTINGS.map((l) => (ids.has(l.id) ? { ...l, availability_status: 'Active' } : l));
      }
    } catch {
      // ignore storage errors
    }
    return SEED_LISTINGS;
  });

  const [liveProjects, setLiveProjects] = useState<Project[]>([]);
  const [localProjects, setLocalProjects] = useState<Project[]>(SEED_PROJECTS);

  const [liveHierarchy, setLiveHierarchy] = useState<ProjectHierarchyItem[]>([]);
  const [localHierarchy, setLocalHierarchy] = useState<ProjectHierarchyItem[]>(SEED_HIERARCHY_ITEMS);

  const [liveEmployment, setLiveEmployment] = useState<EmploymentPosting[]>([]);
  const [localEmployment, setLocalEmployment] = useState<EmploymentPosting[]>(SEED_EMPLOYMENT);

  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  const [localOrders, setLocalOrders] = useState<Order[]>(SEED_ORDERS);

  const [liveDeliveries, setLiveDeliveries] = useState<Delivery[]>([]);
  const [localDeliveries, setLocalDeliveries] = useState<Delivery[]>([]);

  const [liveInvestments, setLiveInvestments] = useState<Investment[]>([]);
  const [localInvestments, setLocalInvestments] = useState<Investment[]>(SEED_INVESTMENTS);

  const [liveProjectReports, setLiveProjectReports] = useState<ProjectInvestmentReport[]>([]);
  const [localProjectReports, setLocalProjectReports] = useState<ProjectInvestmentReport[]>(SEED_PROJECT_REPORTS);

  const [liveExchanges, setLiveExchanges] = useState<PointExchange[]>([]);
  const [localExchanges, setLocalExchanges] = useState<PointExchange[]>(SEED_POINT_EXCHANGES);

  const [liveRefs, setLiveRefs] = useState<TransactionRef[]>([]);
  const [localRefs, setLocalRefs] = useState<TransactionRef[]>(SEED_TRANSACTION_REFS);

  const [liveBatches, setLiveBatches] = useState<BatchPayment[]>([]);
  const [localBatches, setLocalBatches] = useState<BatchPayment[]>(SEED_BATCH_PAYMENTS);

  const [liveGov, setLiveGov] = useState<GovernanceDelegate[]>([]);
  const [localGov, setLocalGov] = useState<GovernanceDelegate[]>(SEED_GOVERNANCE);

  const [liveReports, setLiveReports] = useState<UserReport[]>([]);
  const [localReports, setLocalReports] = useState<UserReport[]>([]);

  const [liveNotifications, setLiveNotifications] = useState<PlatformNotification[]>([]);
  const [localNotifications, setLocalNotifications] = useState<PlatformNotification[]>([
    {
      id: 'notif_seed_1',
      actor_uid: 'UID-2',
      target_uid: 'ADMIN',
      target_auth_uid: '',
      title: 'Daily Hours Threshold Notice',
      message: 'UID-2 logged 8.5 hours on 2026-11-23 (exceeded 8h threshold).',
      is_admin_alert: true,
      read: false,
      created_at: '2026-11-23T19:01:00Z',
    },
  ]);

  const [systemConfig, setSystemConfig] = useState<SystemConfigState>(() => {
    const localCleared =
      typeof window !== 'undefined' && localStorage.getItem('alirada_mock_cleared') === 'true';
    return localCleared
      ? { ...DEFAULT_SYSTEM_CONFIG, total_micro_fees_collected: 0, mock_data_cleared: true }
      : DEFAULT_SYSTEM_CONFIG;
  });
  const [adminDocExists, setAdminDocExists] = useState(false);
  const [adminDelegates, setAdminDelegates] = useState<AdminDelegate[]>([]);

  const pushToast = (kind: ToastMessage['kind'], text: string) => {
    const id = makeId('toast');
    setToasts((prev) => [...prev.slice(-3), { id, kind, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5200);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync HTML dark class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  // Load public platform system_config (intro video & mock_data_cleared) before auth resolves
  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseDb) return;
    getDoc(doc(firebaseDb, 'system_config', 'platform'))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as { value?: Partial<SystemConfigState> };
          if (data.value) {
            setSystemConfig((prev) => ({ ...prev, ...data.value }));
            if (data.value.mock_data_cleared) {
              try {
                localStorage.setItem('alirada_mock_cleared', 'true');
              } catch {
                // ignore storage errors
              }
            }
          }
        }
      })
      .catch(() => {
        // fallback cleanly to default/localStorage
      });
  }, []);

  // Boot connection test & Auth listener
  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth || !firebaseDb) {
      setAuthReady(true);
      return;
    }
    const db = firebaseDb;
    testConnection();
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);

      if (user && user.emailVerified) {
        try {
          const profRef = doc(db, 'profiles', user.uid);
          const snap = await getDoc(profRef);
          if (!snap.exists()) {
            const isBootAdmin = (user.email || '').toLowerCase() === ROOT_ADMIN_EMAIL;
            let assignedUid = 'UID-1';
            if (!isBootAdmin) {
              let maxNum = 9;
              try {
                const existingSnap = await getDocs(
                  query(collection(db, 'profiles'), where('user_status', 'in', ['Active', 'Warning', 'Frozen']))
                );
                existingSnap.docs.forEach((d) => {
                  const u = String((d.data() as { universal_id?: string }).universal_id || '');
                  const n = Number(u.replace('UID-', ''));
                  if (!Number.isNaN(n) && n > maxNum) maxNum = n;
                });
              } catch {
                maxNum = Math.max(10, Math.floor(100 + Math.random() * 800));
              }
              assignedUid = `UID-${maxNum + 1}`;
            }

            const defaultAvatar =
              user.photoURL && user.photoURL.length <= 500
                ? user.photoURL
                : '/src/assets/images/avatar_member_portrait_1795619024258.jpg';

            let pendingMeta: {
              fullName?: string;
              entityType?: EntityType;
              cleanAvatar?: string;
              securityQuestion?: string;
              ansHash?: string;
            } = {};
            try {
              const rawPending = localStorage.getItem(`alirada_pending_${user.uid}`);
              if (rawPending) {
                pendingMeta = JSON.parse(rawPending);
                localStorage.removeItem(`alirada_pending_${user.uid}`);
              }
            } catch {
              // ignore malformed storage
            }

            await setDoc(profRef, {
              uid: user.uid,
              universal_id: assignedUid,
              full_name:
                pendingMeta.fullName ||
                user.displayName ||
                user.email?.split('@')[0] ||
                'Cooperative Member',
              entity_type: pendingMeta.entityType || 'Individual',
              country: '',
              city: '',
              profile_image_url: pendingMeta.cleanAvatar || defaultAvatar,
              image_verified_status: 'Pending',
              user_status: 'Active',
              penalty_score: 0,
              carried_balance: 0,
              absent_period_days: 365,
              last_active_at: new Date().toISOString(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            await setDoc(doc(db, 'profiles_private', user.uid), {
              uid: user.uid,
              email: (user.email || '').toLowerCase(),
              contact_info: '',
              registration_evidence: '',
              evidence_approved: false,
              security_question: pendingMeta.securityQuestion || '',
              security_answer_hash: pendingMeta.ansHash || '',
              successor_email: '',
              legacy_beneficiaries: [],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          console.warn('Profile sync note:', err);
        }
      } else {
        setAdminDocExists(false);
        setAdminDelegates([]);
      }
    });
    return () => unsub();
  }, []);

  const isLiveFirestore = Boolean(
    isFirebaseConfigured && firebaseDb && firebaseAuth && firebaseUser && firebaseUser.emailVerified
  );
  // Safe client reference only used inside isLiveFirestore / isFirebaseConfigured branches
  const db = firebaseDb!;
  const signedEmailLower = (firebaseUser?.email || '').toLowerCase();
  const isRootAdmin = Boolean(isLiveFirestore && signedEmailLower === ROOT_ADMIN_EMAIL);

  const myActiveAdminDelegation = useMemo(() => {
    if (!isLiveFirestore || !signedEmailLower) return undefined;
    return adminDelegates.find(
      (d) => d.active && d.delegate_email.toLowerCase() === signedEmailLower
    );
  }, [isLiveFirestore, signedEmailLower, adminDelegates]);

  const isAdmin = Boolean(
    isRootAdmin || (isLiveFirestore && adminDocExists && Boolean(myActiveAdminDelegation))
  );

  const myDelegatedTasks = useMemo(
    () => (isRootAdmin ? ['ALL_ROOT_ADMIN_TASKS'] : myActiveAdminDelegation?.tasks || []),
    [isRootAdmin, myActiveAdminDelegation]
  );

  // Guard admin section route strictly
  useEffect(() => {
    if (activeSection === 'admin' && !isAdmin) {
      setActiveSection('home');
    }
  }, [activeSection, isAdmin]);

  // Subscribe to own /admins/{uid} doc & /admin_delegates when verified signed in
  useEffect(() => {
    if (!isLiveFirestore || !firebaseUser || !firebaseDb) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'admins', firebaseUser.uid),
        (snap) => {
          setAdminDocExists(snap.exists());
        },
        () => {
          setAdminDocExists(false);
        }
      )
    );

    const delegatesQuery = isRootAdmin
      ? collection(db, 'admin_delegates')
      : query(
          collection(db, 'admin_delegates'),
          where('delegate_email', '==', firebaseUser.email || signedEmailLower)
        );

    unsubs.push(
      onSnapshot(
        delegatesQuery,
        (snap) => {
          const rows: AdminDelegate[] = snap.docs.map((d) => {
            const raw = d.data() as Record<string, unknown>;
            const createdIso =
              raw.createdAt && typeof (raw.createdAt as { toDate?: () => Date }).toDate === 'function'
                ? (raw.createdAt as { toDate: () => Date }).toDate().toISOString()
                : new Date().toISOString();
            return {
              id: d.id,
              delegate_email: String(raw.delegate_email || ''),
              delegate_uid: raw.delegate_uid ? String(raw.delegate_uid) : undefined,
              tasks: Array.isArray(raw.tasks) ? raw.tasks.map(String) : [],
              delegated_by: String(raw.delegated_by || ROOT_ADMIN_EMAIL),
              active: Boolean(raw.active),
              created_at: createdIso,
            };
          });
          setAdminDelegates(rows);
        },
        () => {
          setAdminDelegates([]);
        }
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isLiveFirestore, firebaseUser, isRootAdmin, signedEmailLower]);

  // Auto-claim /admins/{uid} when verified user has an active delegation invite from amrelyon@gmail.com
  useEffect(() => {
    if (!isLiveFirestore || !firebaseUser || isRootAdmin || adminDocExists || !myActiveAdminDelegation) {
      return;
    }
    setDoc(doc(db, 'admins', firebaseUser.uid), {
      uid: firebaseUser.uid,
      email: firebaseUser.email || signedEmailLower,
      invite_id: myActiveAdminDelegation.id,
      granted_by: ROOT_ADMIN_EMAIL,
      createdAt: serverTimestamp(),
    }).catch((err) => {
      console.warn('Admin delegation claim pending:', err);
    });
  }, [isLiveFirestore, firebaseUser, isRootAdmin, adminDocExists, myActiveAdminDelegation, signedEmailLower]);

  const mockDataCleared = Boolean(systemConfig.mock_data_cleared);

  // Strip seed data immediately whenever mockDataCleared becomes true
  useEffect(() => {
    if (!mockDataCleared) return;
    setLocalProfiles((prev) => prev.filter((x) => !SEED_IDS.profiles.has(x.id)));
    setLocalServiceLogs((prev) => prev.filter((x) => !SEED_IDS.serviceLogs.has(x.id)));
    setLocalDeductionLogs((prev) => prev.filter((x) => !SEED_IDS.deductions.has(x.id)));
    setLocalVotes((prev) => prev.filter((x) => !SEED_IDS.votes.has(x.id)));
    setLocalListings((prev) => prev.filter((x) => !SEED_IDS.listings.has(x.id)));
    setLocalProjects((prev) => prev.filter((x) => !SEED_IDS.projects.has(x.id)));
    setLocalHierarchy((prev) => prev.filter((x) => !SEED_IDS.hierarchy.has(x.id)));
    setLocalEmployment((prev) => prev.filter((x) => !SEED_IDS.jobs.has(x.id)));
    setLocalOrders((prev) => prev.filter((x) => !SEED_IDS.orders.has(x.id)));
    setLocalInvestments((prev) => prev.filter((x) => !SEED_IDS.investments.has(x.id)));
    setLocalProjectReports((prev) => prev.filter((x) => !SEED_IDS.projectReports.has(x.id)));
    setLocalExchanges((prev) => prev.filter((x) => !SEED_IDS.exchanges.has(x.id)));
    setLocalRefs((prev) => prev.filter((x) => !SEED_IDS.refs.has(x.id)));
    setLocalBatches((prev) => prev.filter((x) => !SEED_IDS.batches.has(x.id)));
    setLocalGov((prev) => prev.filter((x) => !SEED_IDS.gov.has(x.id)));
    setLocalNotifications((prev) => prev.filter((x) => !SEED_IDS.notifs.has(x.id)));
  }, [mockDataCleared]);

  // Subscribe to Firestore collections when authenticated & verified
  useEffect(() => {
    if (!isLiveFirestore || !firebaseUser) return;

    const unsubs: (() => void)[] = [];

    const mapDocRow = <T extends { id: string }>(d: { id: string; data: () => unknown }): T => {
      const raw = (d.data() || {}) as Record<string, unknown>;
      const createdIso =
        raw.createdAt && typeof (raw.createdAt as { toDate?: () => Date }).toDate === 'function'
          ? (raw.createdAt as { toDate: () => Date }).toDate().toISOString()
          : (raw.created_at as string) || new Date().toISOString();
      const updatedIso =
        raw.updatedAt && typeof (raw.updatedAt as { toDate?: () => Date }).toDate === 'function'
          ? (raw.updatedAt as { toDate: () => Date }).toDate().toISOString()
          : (raw.updated_at as string) || createdIso;
      return {
        ...(raw as object),
        id: d.id,
        created_at: createdIso,
        updated_at: updatedIso,
      } as unknown as T;
    };

    const bindCollection = <T extends { id: string }>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      customQuery?: ReturnType<typeof query>
    ) => {
      const target = customQuery || collection(db, colName);
      const unsub = onSnapshot(
        target,
        (snap) => {
          setter(snap.docs.map((d) => mapDocRow<T>(d)));
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, colName);
        }
      );
      unsubs.push(unsub);
    };

    const bindMultiCollection = <T extends { id: string }>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      queries: ReturnType<typeof query>[]
    ) => {
      const buckets: T[][] = queries.map(() => []);
      const flush = () => {
        const merged = new Map<string, T>();
        buckets.forEach((rows) => {
          rows.forEach((item) => merged.set(item.id, item));
        });
        setter(Array.from(merged.values()));
      };
      queries.forEach((q, idx) => {
        unsubs.push(
          onSnapshot(
            q,
            (snap) => {
              buckets[idx] = snap.docs.map((d) => mapDocRow<T>(d));
              flush();
            },
            (err) => handleFirestoreError(err, OperationType.LIST, colName)
          )
        );
      });
    };

    const bindDualCollection = <T extends { id: string }>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      q1: ReturnType<typeof query>,
      q2: ReturnType<typeof query>
    ) => bindMultiCollection<T>(colName, setter, [q1, q2]);

    bindCollection<AliradaProfile>(
      'profiles',
      setLiveProfiles,
      query(collection(db, 'profiles'), where('user_status', 'in', ['Active', 'Warning', 'Frozen']))
    );

    // Owner/admin private profile subscription
    const privQuery = isAdmin
      ? collection(db, 'profiles_private')
      : query(collection(db, 'profiles_private'), where('uid', '==', firebaseUser.uid));
    unsubs.push(
      onSnapshot(
        privQuery,
        (snap) => {
          const map: Record<string, Partial<AliradaProfile>> = {};
          snap.docs.forEach((d) => {
            map[d.id] = d.data() as Partial<AliradaProfile>;
          });
          setPrivateProfileMap(map);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'profiles_private')
      )
    );

    bindCollection<ServiceLog>(
      'service_logs',
      setLiveServiceLogs,
      query(collection(db, 'service_logs'), where('final_score', '>=', 0))
    );
    bindCollection<RequestedServantLog>(
      'requested_servant_logs',
      setLiveDeductionLogs,
      query(collection(db, 'requested_servant_logs'), where('deducted_score', '>=', 0))
    );
    bindCollection<RecognitionVote>(
      'recognition_votes',
      setLiveVotes,
      query(collection(db, 'recognition_votes'), where('direction', 'in', ['UPWARD', 'COMPENSATE']))
    );
    bindCollection<Listing>(
      'listings',
      setLiveListings,
      query(collection(db, 'listings'), where('price_points', '>=', 0))
    );
    if (isAdmin) {
      bindCollection<Project>('projects', setLiveProjects);
    } else {
      bindDualCollection<Project>(
        'projects',
        setLiveProjects,
        query(collection(db, 'projects'), where('visibility', '==', 'Public')),
        query(collection(db, 'projects'), where('owner_auth_uid', '==', firebaseUser.uid))
      );
    }
    bindCollection<ProjectHierarchyItem>(
      'project_hierarchy_items',
      setLiveHierarchy,
      query(
        collection(db, 'project_hierarchy_items'),
        where('approval_status', 'in', ['Pending', 'Approved', 'Rejected'])
      )
    );
    bindCollection<EmploymentPosting>(
      'employment_postings',
      setLiveEmployment,
      query(collection(db, 'employment_postings'), where('status', 'in', ['Open', 'Filled', 'Closed']))
    );

    if (isAdmin) {
      bindCollection<Order>('orders', setLiveOrders);
      bindCollection<Delivery>('deliveries', setLiveDeliveries);
      bindCollection<TransactionRef>('transaction_refs', setLiveRefs);
      bindCollection<BatchPayment>('batch_payments', setLiveBatches);
      bindCollection<UserReport>('user_reports', setLiveReports);
      bindDualCollection<PlatformNotification>(
        'notifications',
        setLiveNotifications,
        query(collection(db, 'notifications'), where('target_auth_uid', '==', firebaseUser.uid)),
        query(collection(db, 'notifications'), where('is_admin_alert', '==', true))
      );
    } else {
      bindDualCollection<Order>(
        'orders',
        setLiveOrders,
        query(collection(db, 'orders'), where('buyer_auth_uid', '==', firebaseUser.uid)),
        query(collection(db, 'orders'), where('seller_auth_uid', '==', firebaseUser.uid))
      );
      bindDualCollection<Delivery>(
        'deliveries',
        setLiveDeliveries,
        query(collection(db, 'deliveries'), where('receiver_auth_uid', '==', firebaseUser.uid)),
        query(collection(db, 'deliveries'), where('seller_auth_uid', '==', firebaseUser.uid))
      );
      bindMultiCollection<TransactionRef>('transaction_refs', setLiveRefs, [
        query(collection(db, 'transaction_refs'), where('issuer_auth_uid', '==', firebaseUser.uid)),
        query(collection(db, 'transaction_refs'), where('counterparty_auth_uid', '==', firebaseUser.uid)),
        query(
          collection(db, 'transaction_refs'),
          where('participant_auth_uids', 'array-contains', firebaseUser.uid)
        ),
        query(collection(db, 'transaction_refs'), where('status', '==', 'Open')),
      ]);
      bindCollection<BatchPayment>(
        'batch_payments',
        setLiveBatches,
        query(collection(db, 'batch_payments'), where('creator_auth_uid', '==', firebaseUser.uid))
      );
      bindCollection<UserReport>(
        'user_reports',
        setLiveReports,
        query(collection(db, 'user_reports'), where('reporter_auth_uid', '==', firebaseUser.uid))
      );
      bindCollection<PlatformNotification>(
        'notifications',
        setLiveNotifications,
        query(collection(db, 'notifications'), where('target_auth_uid', '==', firebaseUser.uid))
      );
    }

    bindCollection<Investment>(
      'investments',
      setLiveInvestments,
      query(collection(db, 'investments'), where('invested_points', '>', 0))
    );
    bindCollection<ProjectInvestmentReport>(
      'project_investment_reports',
      setLiveProjectReports,
      query(collection(db, 'project_investment_reports'), where('period_cost_points', '>=', 0))
    );
    bindCollection<PointExchange>(
      'point_exchanges',
      setLiveExchanges,
      query(collection(db, 'point_exchanges'), where('points_requested', '>', 0))
    );
    bindCollection<GovernanceDelegate>(
      'governance_delegates',
      setLiveGov,
      query(
        collection(db, 'governance_delegates'),
        where('scope', 'in', ['INSTITUTIONAL', 'PLATFORM'])
      )
    );

    // System Config doc
    unsubs.push(
      onSnapshot(
        doc(db, 'system_config', 'platform'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as { value?: Partial<SystemConfigState> };
            if (data.value) {
              setSystemConfig((prev) => ({ ...prev, ...data.value }));
            }
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'system_config/platform')
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isLiveFirestore, firebaseUser, isAdmin]);

  // Combined merged collections (Live Firestore overrides seed by ID / UID; seed records stay clean until purged)
  const profiles = useMemo(() => {
    const merged = isLiveFirestore
      ? mergeProfilesByUid(liveProfiles, localProfiles)
      : localProfiles;
    return merged.map((p) => ({
      ...p,
      ...(privateProfileMap[p.uid] || {}),
    }));
  }, [isLiveFirestore, liveProfiles, localProfiles, privateProfileMap]);

  const serviceLogs = useMemo(
    () => (isLiveFirestore ? mergeById(liveServiceLogs, localServiceLogs) : localServiceLogs),
    [isLiveFirestore, liveServiceLogs, localServiceLogs]
  );
  const deductionLogs = useMemo(
    () => (isLiveFirestore ? mergeById(liveDeductionLogs, localDeductionLogs) : localDeductionLogs),
    [isLiveFirestore, liveDeductionLogs, localDeductionLogs]
  );
  const recognitionVotes = useMemo(
    () => (isLiveFirestore ? mergeById(liveVotes, localVotes) : localVotes),
    [isLiveFirestore, liveVotes, localVotes]
  );
  const listings = useMemo(
    () => (isLiveFirestore ? mergeById(liveListings, localListings) : localListings),
    [isLiveFirestore, liveListings, localListings]
  );
  const projects = useMemo(
    () => (isLiveFirestore ? mergeById(liveProjects, localProjects) : localProjects),
    [isLiveFirestore, liveProjects, localProjects]
  );
  const hierarchyItems = useMemo(
    () => (isLiveFirestore ? mergeById(liveHierarchy, localHierarchy) : localHierarchy),
    [isLiveFirestore, liveHierarchy, localHierarchy]
  );
  const employmentPostings = useMemo(
    () => (isLiveFirestore ? mergeById(liveEmployment, localEmployment) : localEmployment),
    [isLiveFirestore, liveEmployment, localEmployment]
  );
  const orders = useMemo(
    () => (isLiveFirestore ? mergeById(liveOrders, localOrders) : localOrders),
    [isLiveFirestore, liveOrders, localOrders]
  );
  const deliveries = useMemo(
    () => (isLiveFirestore ? mergeById(liveDeliveries, localDeliveries) : localDeliveries),
    [isLiveFirestore, liveDeliveries, localDeliveries]
  );
  const investments = useMemo(
    () => (isLiveFirestore ? mergeById(liveInvestments, localInvestments) : localInvestments),
    [isLiveFirestore, liveInvestments, localInvestments]
  );
  const projectReports = useMemo(
    () => (isLiveFirestore ? mergeById(liveProjectReports, localProjectReports) : localProjectReports),
    [isLiveFirestore, liveProjectReports, localProjectReports]
  );
  const pointExchanges = useMemo(
    () => (isLiveFirestore ? mergeById(liveExchanges, localExchanges) : localExchanges),
    [isLiveFirestore, liveExchanges, localExchanges]
  );
  const transactionRefs = useMemo(
    () => (isLiveFirestore ? mergeById(liveRefs, localRefs) : localRefs),
    [isLiveFirestore, liveRefs, localRefs]
  );
  const batchPayments = useMemo(
    () => (isLiveFirestore ? mergeById(liveBatches, localBatches) : localBatches),
    [isLiveFirestore, liveBatches, localBatches]
  );
  const governanceDelegates = useMemo(
    () => (isLiveFirestore ? mergeById(liveGov, localGov) : localGov),
    [isLiveFirestore, liveGov, localGov]
  );
  const userReports = useMemo(
    () => (isLiveFirestore ? mergeById(liveReports, localReports) : localReports),
    [isLiveFirestore, liveReports, localReports]
  );
  const notifications = useMemo(
    () => (isLiveFirestore ? mergeById(liveNotifications, localNotifications) : localNotifications),
    [isLiveFirestore, liveNotifications, localNotifications]
  );

  const mockRecordCount = useMemo(() => {
    return (
      localProfiles.filter((x) => SEED_IDS.profiles.has(x.id)).length +
      localServiceLogs.filter((x) => SEED_IDS.serviceLogs.has(x.id)).length +
      localDeductionLogs.filter((x) => SEED_IDS.deductions.has(x.id)).length +
      localVotes.filter((x) => SEED_IDS.votes.has(x.id)).length +
      localListings.filter((x) => SEED_IDS.listings.has(x.id)).length +
      localProjects.filter((x) => SEED_IDS.projects.has(x.id)).length +
      localHierarchy.filter((x) => SEED_IDS.hierarchy.has(x.id)).length +
      localEmployment.filter((x) => SEED_IDS.jobs.has(x.id)).length +
      localOrders.filter((x) => SEED_IDS.orders.has(x.id)).length +
      localInvestments.filter((x) => SEED_IDS.investments.has(x.id)).length +
      localProjectReports.filter((x) => SEED_IDS.projectReports.has(x.id)).length +
      localExchanges.filter((x) => SEED_IDS.exchanges.has(x.id)).length +
      localRefs.filter((x) => SEED_IDS.refs.has(x.id)).length +
      localBatches.filter((x) => SEED_IDS.batches.has(x.id)).length +
      localGov.filter((x) => SEED_IDS.gov.has(x.id)).length +
      localNotifications.filter((x) => SEED_IDS.notifs.has(x.id)).length
    );
  }, [
    localProfiles,
    localServiceLogs,
    localDeductionLogs,
    localVotes,
    localListings,
    localProjects,
    localHierarchy,
    localEmployment,
    localOrders,
    localInvestments,
    localProjectReports,
    localExchanges,
    localRefs,
    localBatches,
    localGov,
    localNotifications,
  ]);

  const currentProfile: AliradaProfile = useMemo(() => {
    if (isLiveFirestore && firebaseUser) {
      const found = profiles.find((p) => p.uid === firebaseUser.uid);
      if (found) return found;
      return {
        ...GUEST_PROFILE,
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        universal_id: signedEmailLower === ROOT_ADMIN_EMAIL ? 'UID-1' : 'PENDING',
        full_name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Member',
        email: firebaseUser.email || '',
      };
    }
    return GUEST_PROFILE;
  }, [isLiveFirestore, firebaseUser, profiles, signedEmailLower]);

  const requireVerifiedAuth = (): boolean => {
    if (!isLiveFirestore || !firebaseUser) {
      setAuthModalOpen(true);
      pushToast('warning', 'Please sign in with a verified email account to perform this action.');
      return false;
    }
    return true;
  };

  const metricsMap = useMemo(() => {
    const today = todayIso();
    const map: Record<string, LedgerMetrics> = {};
    profiles.forEach((p) => {
      map[p.universal_id] = computeUserLedgerMetrics(
        p,
        serviceLogs,
        deductionLogs,
        orders,
        investments,
        transactionRefs,
        batchPayments,
        pointExchanges,
        recognitionVotes,
        systemConfig,
        today
      );
    });
    return map;
  }, [
    profiles,
    serviceLogs,
    deductionLogs,
    orders,
    investments,
    transactionRefs,
    batchPayments,
    pointExchanges,
    recognitionVotes,
    systemConfig,
  ]);

  // Auth Methods
  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      pushToast(
        'warning',
        'Firebase config is not set in this build. Add VITE_FIREBASE_* or FIREBASE_APPLET_CONFIG in GitHub Secrets.'
      );
      return;
    }
    try {
      await signInWithPopup(firebaseAuth, googleAuthProvider);
      setAuthModalOpen(false);
      pushToast('success', 'Signed in to Alirada with Google.');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Google sign-in failed.';
      pushToast('error', msg);
    }
  };

  const signInEmail = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      pushToast(
        'warning',
        'Firebase config is not set in this build. Add VITE_FIREBASE_* or FIREBASE_APPLET_CONFIG in GitHub Secrets.'
      );
      return;
    }
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
        pushToast('warning', 'Verification email sent. Please verify your email before writing records.');
      } else {
        setAuthModalOpen(false);
        pushToast('success', 'Signed in successfully.');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Email sign-in error.';
      pushToast('error', msg);
    }
  };

  const registerEmail = async (
    email: string,
    password: string,
    fullName: string,
    entityType: EntityType,
    avatarUrl: string,
    securityQuestion: string,
    securityAnswer: string
  ) => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      pushToast(
        'warning',
        'Firebase config is not set in this build. Add VITE_FIREBASE_* or FIREBASE_APPLET_CONFIG in GitHub Secrets.'
      );
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await sendEmailVerification(cred.user);
      const ansHash = securityAnswer ? await sha256Hex(securityAnswer) : '';
      const cleanAvatar =
        sanitizeExternalLink(avatarUrl) || '/src/assets/images/avatar_member_portrait_1795619024258.jpg';

      // Store local/pending profile info for when verification completes
      localStorage.setItem(
        `alirada_pending_${cred.user.uid}`,
        JSON.stringify({ fullName, entityType, cleanAvatar, securityQuestion, ansHash })
      );
      pushToast(
        'success',
        'Account created. Check your inbox to verify your email, then sign in.'
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Registration error.';
      pushToast('error', msg);
    }
  };

  const recoverViaSecurityQuestion = async (
    email: string,
    answer: string
  ): Promise<{ verified: boolean; message: string }> => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      return {
        verified: false,
        message: 'Firebase config is not set in this build. Add VITE_FIREBASE_* or FIREBASE_APPLET_CONFIG in GitHub Secrets.',
      };
    }
    const cleanEmail = email.trim().toLowerCase();
    const target = profiles.find((p) => (p.email || '').toLowerCase() === cleanEmail);
    if (target && target.security_answer_hash) {
      const hashed = await sha256Hex(answer);
      if (hashed !== target.security_answer_hash) {
        return { verified: false, message: 'Security answer does not match our records.' };
      }
    }
    try {
      await sendPasswordResetEmail(firebaseAuth, cleanEmail);
      return {
        verified: true,
        message: 'Security check passed. A password reset link has been dispatched to your email.',
      };
    } catch (err: unknown) {
      return {
        verified: false,
        message:
          err instanceof Error
            ? err.message
            : 'Unable to send reset email right now. Ensure Email/Password provider is enabled.',
      };
    }
  };

  const signOutUser = async () => {
    if (!firebaseAuth) return;
    await signOut(firebaseAuth);
    pushToast('success', 'Signed out cleanly.');
  };

  const updateOwnProfile: AliradaContextValue['updateOwnProfile'] = async (patch) => {
    if (!requireVerifiedAuth()) return false;
    const uid = currentProfile.uid;
    const prevProfiles = localProfiles;
    const updatedAt = new Date().toISOString();
    setLocalProfiles((prev) =>
      prev.map((p) => (p.uid === uid ? { ...p, ...patch } : p))
    );
    if (isLiveFirestore && firebaseUser && firebaseUser.uid === uid) {
      try {
        await updateDoc(doc(db, 'profiles', uid), {
          full_name: patch.full_name ?? currentProfile.full_name,
          entity_type: patch.entity_type ?? currentProfile.entity_type,
          country: patch.country ?? currentProfile.country,
          city: patch.city ?? currentProfile.city,
          profile_image_url: patch.profile_image_url ?? currentProfile.profile_image_url,
          absent_period_days: patch.absent_period_days ?? currentProfile.absent_period_days,
          last_active_at: updatedAt,
          updatedAt: serverTimestamp(),
        });
        if (
          patch.contact_info !== undefined ||
          patch.security_question !== undefined ||
          patch.security_answer_hash !== undefined ||
          patch.registration_evidence !== undefined
        ) {
          await updateDoc(doc(db, 'profiles_private', uid), {
            contact_info: patch.contact_info ?? currentProfile.contact_info ?? '',
            registration_evidence:
              patch.registration_evidence ?? currentProfile.registration_evidence ?? '',
            security_question:
              patch.security_question ?? currentProfile.security_question ?? '',
            security_answer_hash:
              patch.security_answer_hash ?? currentProfile.security_answer_hash ?? '',
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        setLocalProfiles(prevProfiles);
        console.error('updateOwnProfile error:', err);
        pushToast(
          'error',
          err instanceof Error ? err.message : 'Unable to save profile changes.'
        );
        return false;
      }
    }
    pushToast('success', 'Profile updated.');
    return true;
  };

  const saveLegacyProtocol = async (
    absentDays: number,
    successorEmail: string,
    beneficiaries: LegacyBeneficiary[]
  ) => {
    if (!requireVerifiedAuth()) return;
    const totalPct = beneficiaries.reduce((acc, b) => acc + b.percentage, 0);
    if (beneficiaries.length > 0 && Math.abs(totalPct - 100) > 0.01) {
      pushToast('error', 'Legacy beneficiary percentages must sum to 100%.');
      return;
    }
    const uid = currentProfile.uid;
    setLocalProfiles((prev) =>
      prev.map((p) =>
        p.uid === uid
          ? {
              ...p,
              absent_period_days: absentDays,
              successor_email: successorEmail,
              legacy_beneficiaries: beneficiaries,
            }
          : p
      )
    );
    if (isLiveFirestore && firebaseUser) {
      try {
        await updateDoc(doc(db, 'profiles', uid), {
          absent_period_days: absentDays,
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'profiles_private', uid), {
          successor_email: successorEmail,
          legacy_beneficiaries: beneficiaries,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `profiles_private/${uid}`);
      }
    }
    pushToast('success', 'Absent-Period Legacy Protocol saved.');
  };

  const emitAdminAlert = async (title: string, message: string) => {
    const id = makeId('notif');
    const record: PlatformNotification = {
      id,
      actor_uid: currentProfile.universal_id,
      target_uid: 'ADMIN',
      target_auth_uid: firebaseUser?.uid || 'seed_uid_1',
      title,
      message,
      is_admin_alert: true,
      read: false,
      created_at: new Date().toISOString(),
    };
    setLocalNotifications((prev) => [record, ...prev]);
    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'notifications', id), {
          actor_uid: record.actor_uid,
          target_uid: record.target_uid,
          target_auth_uid: record.target_auth_uid,
          title: record.title,
          message: record.message,
          is_admin_alert: true,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Notification write warning:', err);
      }
    }
  };

  // Core Service Log
  const logService: AliradaContextValue['logService'] = async (payload) => {
    if (!requireVerifiedAuth()) return false;
    if (currentProfile.user_status === 'Frozen' || currentProfile.user_status === 'Blocked') {
      pushToast('error', `Account is ${currentProfile.user_status}. Service logging is disabled.`);
      return false;
    }
    const providerUid = currentProfile.universal_id;
    const recipientUid = payload.recipient_uid.trim().toUpperCase();
    if (!recipientUid || recipientUid === providerUid) {
      pushToast('error', 'Self-service prohibited: Provider and Recipient UID must differ.');
      return false;
    }
    if (payload.hours <= 0 || payload.hardship < 1 || payload.hardship > 10) {
      pushToast('error', 'Hours must be > 0 and Hardship must be between 1 and 10.');
      return false;
    }

    const dayHoursBefore = serviceLogs
      .filter((l) => l.provider_uid === providerUid && l.logged_date === payload.logged_date)
      .reduce((acc, l) => acc + l.hours, 0);

    if (dayHoursBefore + payload.hours > systemConfig.daily_max_hours) {
      pushToast(
        'error',
        `Daily cap exceeded (${dayHoursBefore}h logged + ${payload.hours}h > ${systemConfig.daily_max_hours}h max).`
      );
      return false;
    }

    const exceedsWarn = dayHoursBefore + payload.hours > systemConfig.daily_warn_hours;
    const finalScore = Number((payload.hours * payload.hardship).toFixed(2));
    const id = makeId('srv');
    const logNumber = `SRV-${new Date().getFullYear()}-${String(serviceLogs.length + 105).padStart(4, '0')}`;

    const entry: ServiceLog = {
      id,
      log_number: logNumber,
      logged_date: payload.logged_date,
      provider_uid: providerUid,
      provider_auth_uid: firebaseUser?.uid || currentProfile.uid,
      recipient_uid: recipientUid,
      service_type: payload.service_type,
      hours: payload.hours,
      hardship: Math.round(payload.hardship),
      final_score: finalScore,
      evidence_link: sanitizeExternalLink(payload.evidence_link),
      google_map_link: sanitizeExternalLink(payload.google_map_link),
      notes: payload.notes?.trim() || '',
      project_context: payload.project_context?.trim() || '',
      entity_type: currentProfile.entity_type,
      daily_exceed_flag: exceedsWarn,
      created_at: new Date().toISOString(),
    };

    setLocalServiceLogs((prev) => [entry, ...prev]);

    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'service_logs', id), {
          log_number: entry.log_number,
          logged_date: entry.logged_date,
          provider_uid: entry.provider_uid,
          provider_auth_uid: firebaseUser.uid,
          recipient_uid: entry.recipient_uid,
          service_type: entry.service_type,
          hours: entry.hours,
          hardship: entry.hardship,
          final_score: entry.final_score,
          evidence_link: entry.evidence_link || '',
          google_map_link: entry.google_map_link || '',
          notes: entry.notes || '',
          project_context: entry.project_context || '',
          entity_type: entry.entity_type || 'Individual',
          daily_exceed_flag: entry.daily_exceed_flag,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `service_logs/${id}`);
      }
    }

    if (exceedsWarn) {
      await emitAdminAlert(
        'Daily Hours Threshold Exceeded',
        `${providerUid} reached ${(dayHoursBefore + payload.hours).toFixed(1)}h on ${payload.logged_date} (threshold ${systemConfig.daily_warn_hours}h).`
      );
      pushToast('warning', `Logged +${finalScore} pts. Admin alert issued for exceeding ${systemConfig.daily_warn_hours}h daily threshold.`);
    } else {
      pushToast('success', `Service logged: +${finalScore} points (${payload.hours}h × ${payload.hardship}).`);
    }

    return true;
  };

  const logRequestedServant: AliradaContextValue['logRequestedServant'] = async (payload) => {
    if (!requireVerifiedAuth()) return false;
    const requesterUid = currentProfile.universal_id;
    const servantUid = payload.requested_servant_uid.trim().toUpperCase();
    if (!servantUid || servantUid === requesterUid) {
      pushToast('error', 'Servant UID and Requester UID cannot be identical.');
      return false;
    }
    const servantMetrics = metricsMap[servantUid];
    if (
      servantMetrics &&
      servantMetrics.balance - payload.deducted_score < systemConfig.negative_points_floor
    ) {
      pushToast(
        'error',
        `Deduction blocked: ${servantUid} would fall below the ${systemConfig.negative_points_floor} points floor.`
      );
      return false;
    }
    const id = makeId('req');
    const entry: RequestedServantLog = {
      id,
      request_number: `REQ-${new Date().getFullYear()}-${String(deductionLogs.length + 45).padStart(4, '0')}`,
      logged_date: payload.logged_date,
      requested_servant_uid: servantUid,
      requester_uid: requesterUid,
      requester_auth_uid: firebaseUser?.uid || currentProfile.uid,
      related_service_log_id: payload.related_service_log_id || '',
      deducted_score: payload.deducted_score,
      evidence_link: sanitizeExternalLink(payload.evidence_link),
      notes: payload.notes?.trim() || '',
      entity_type: currentProfile.entity_type,
      status: 'Recorded',
      created_at: new Date().toISOString(),
    };
    setLocalDeductionLogs((prev) => [entry, ...prev]);

    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'requested_servant_logs', id), {
          request_number: entry.request_number,
          logged_date: entry.logged_date,
          requested_servant_uid: entry.requested_servant_uid,
          requester_uid: entry.requester_uid,
          requester_auth_uid: firebaseUser.uid,
          related_service_log_id: entry.related_service_log_id || '',
          deducted_score: entry.deducted_score,
          evidence_link: entry.evidence_link || '',
          notes: entry.notes || '',
          entity_type: entry.entity_type || 'Individual',
          status: 'Recorded',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `requested_servant_logs/${id}`);
      }
    }

    pushToast('success', `Deduction of ${payload.deducted_score} pts recorded for ${servantUid}.`);
    return true;
  };

  const castRecognitionVote: AliradaContextValue['castRecognitionVote'] = async (
    targetUid,
    direction,
    comment
  ) => {
    if (!requireVerifiedAuth()) return false;
    const cleanTarget = targetUid.trim().toUpperCase();
    if (!cleanTarget || cleanTarget === currentProfile.universal_id) {
      pushToast('error', 'Self-recognition voting is strictly prohibited.');
      return false;
    }
    const hasReceivedService = serviceLogs.some(
      (l) =>
        l.provider_uid.toUpperCase() === cleanTarget &&
        l.recipient_uid.toUpperCase() === currentProfile.universal_id.toUpperCase()
    );
    if (!hasReceivedService) {
      pushToast(
        'error',
        `Only members who received a logged service from ${cleanTarget} can submit recognition.`
      );
      return false;
    }
    if (!comment.trim()) {
      pushToast('error', 'Please provide an audit reason/comment for recognition.');
      return false;
    }
    const voteId = `${cleanTarget}_${currentProfile.universal_id}`;
    const existingVote = recognitionVotes.find((v) => v.id === voteId);
    const vote: RecognitionVote = {
      id: voteId,
      target_uid: cleanTarget,
      recognizer_uid: currentProfile.universal_id,
      recognizer_auth_uid: firebaseUser?.uid || currentProfile.uid,
      direction,
      comment: comment.trim(),
      reply: existingVote?.reply,
      replied_at: existingVote?.replied_at,
      created_at: existingVote?.created_at || new Date().toISOString(),
    };
    const prevVotes = localVotes;
    setLocalVotes((prev) => [vote, ...prev.filter((v) => v.id !== voteId)]);

    if (isLiveFirestore && firebaseUser) {
      try {
        const voteRef = doc(db, 'recognition_votes', voteId);
        const snap = await getDoc(voteRef);
        if (snap.exists()) {
          await updateDoc(voteRef, {
            direction: vote.direction,
            comment: vote.comment,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(voteRef, {
            target_uid: vote.target_uid,
            recognizer_uid: vote.recognizer_uid,
            recognizer_auth_uid: firebaseUser.uid,
            direction: vote.direction,
            comment: vote.comment,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        setLocalVotes(prevVotes);
        console.error('castRecognitionVote error:', err);
        pushToast(
          'error',
          err instanceof Error ? err.message : 'Unable to save recognition vote.'
        );
        return false;
      }
    }

    pushToast('success', `${direction === 'UPWARD' ? 'Upward' : 'Compensate'} recognition saved for ${cleanTarget}.`);
    return true;
  };

  const replyToRecognition: AliradaContextValue['replyToRecognition'] = async (voteId, replyText) => {
    if (!requireVerifiedAuth()) return false;
    const targetVote = recognitionVotes.find((v) => v.id === voteId);
    if (!targetVote) return false;
    if (
      targetVote.target_uid.toUpperCase() !== currentProfile.universal_id.toUpperCase() &&
      !isAdmin
    ) {
      pushToast('error', 'Only the member who received this recognition can reply to it.');
      return false;
    }
    const cleanReply = replyText.trim().slice(0, 500);
    if (!cleanReply) {
      pushToast('error', 'Reply text cannot be empty.');
      return false;
    }
    const repliedAt = new Date().toISOString();
    setLocalVotes((prev) =>
      prev.map((v) =>
        v.id === voteId ? { ...v, reply: cleanReply, replied_at: repliedAt } : v
      )
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.votes.has(voteId)) {
      try {
        await updateDoc(doc(db, 'recognition_votes', voteId), {
          reply: cleanReply,
          replied_at: repliedAt,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `recognition_votes/${voteId}`);
      }
    }
    pushToast('success', 'Reply recorded on peer recognition.');
    return true;
  };

  // Marketplace & Project Investment Links
  const createListing: AliradaContextValue['createListing'] = async (payload) => {
    if (!requireVerifiedAuth()) return false;
    const id = makeId('lst');
    const listingCode = `LST-${payload.listing_type.slice(0, 4).toUpperCase()}-${String(listings.length + 10)}`;
    const cleanTitle = payload.title.trim().slice(0, 160);
    const cleanCategory = (payload.category || 'Crafts & Production').trim().slice(0, 100);
    const cleanDescription = payload.description.trim().slice(0, 2000);
    const cleanImages = (payload.image_urls || []).slice(0, 10);
    if (!cleanTitle || !cleanDescription) {
      pushToast('error', 'Listing title and description are required.');
      return false;
    }
    const record: Listing = {
      ...payload,
      id,
      listing_code: listingCode,
      owner_uid: currentProfile.universal_id,
      owner_auth_uid: firebaseUser?.uid || currentProfile.uid,
      title: cleanTitle,
      category: cleanCategory,
      description: cleanDescription,
      image_urls: cleanImages,
      google_map_link: sanitizeExternalLink(payload.google_map_link),
      video_url: sanitizeExternalLink(payload.video_url),
      evidence_link: sanitizeExternalLink(payload.evidence_link),
      linked_project_id: payload.linked_project_id || undefined,
      availability_status: 'Active',
      is_deactivated: false,
      obligation_status: 'None',
      created_at: new Date().toISOString(),
    };
    setLocalListings((prev) => [record, ...prev]);

    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'listings', id), {
          listing_code: record.listing_code,
          owner_uid: record.owner_uid,
          owner_auth_uid: firebaseUser.uid,
          listing_type: record.listing_type,
          title: record.title,
          category: record.category,
          description: record.description,
          delivery_method: (record.delivery_method || '').slice(0, 100),
          location: (record.location || '').slice(0, 160),
          google_map_link: record.google_map_link || '',
          contact_info: (record.contact_info || '').slice(0, 200),
          image_urls: record.image_urls,
          video_url: record.video_url || '',
          evidence_link: record.evidence_link || '',
          price_points: record.price_points,
          payment_model: record.payment_model,
          end_date: record.end_date || '',
          linked_project_id: record.linked_project_id || '',
          entity_type: currentProfile.entity_type,
          availability_status: 'Active',
          is_deactivated: false,
          obligation_status: 'None',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Create listing Firestore error:', err);
        setLocalListings((prev) => prev.filter((l) => l.id !== id));
        pushToast(
          'error',
          err instanceof Error ? `Could not publish listing: ${err.message}` : 'Could not publish listing.'
        );
        return false;
      }
    }
    pushToast('success', `Listing ${record.listing_code} published and Active for orders.`);
    return true;
  };

  const updateListing: AliradaContextValue['updateListing'] = async (id, patch) => {
    if (!requireVerifiedAuth()) return false;
    const existing = listings.find((l) => l.id === id);
    if (!existing) return false;
    if (existing.obligation_status === 'HasObligations' && !isAdmin) {
      pushToast('error', 'Cannot edit core terms after orders exist. You may deactivate new orders instead.');
      return false;
    }
    setLocalListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    if (isLiveFirestore && firebaseUser && !SEED_IDS.listings.has(id)) {
      try {
        const allowedPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
        const allowedKeys: (keyof Listing)[] = [
          'title',
          'category',
          'description',
          'delivery_method',
          'location',
          'google_map_link',
          'contact_info',
          'image_urls',
          'video_url',
          'evidence_link',
          'price_points',
          'payment_model',
          'end_date',
          'linked_project_id',
          'availability_status',
          'is_deactivated',
          'obligation_status',
        ];
        allowedKeys.forEach((k) => {
          if (patch[k] !== undefined) allowedPatch[k] = patch[k];
        });
        await updateDoc(doc(db, 'listings', id), allowedPatch);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `listings/${id}`);
      }
    }
    pushToast('success', 'Listing updated.');
    return true;
  };

  const deactivateListing: AliradaContextValue['deactivateListing'] = async (listingId, deactivated) => {
    if (!requireVerifiedAuth()) return false;
    const target = listings.find((l) => l.id === listingId);
    if (!target) return false;
    if (target.owner_uid !== currentProfile.universal_id && !isAdmin) {
      pushToast('error', 'Only the listing owner or administrator can deactivate or reactivate a listing.');
      return false;
    }
    const nextAvailability: 'Active' | 'Deactivated' = deactivated ? 'Deactivated' : 'Active';
    setLocalListings((prev) =>
      prev.map((l) =>
        l.id === listingId
          ? { ...l, is_deactivated: deactivated, availability_status: nextAvailability }
          : l
      )
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.listings.has(listingId)) {
      try {
        await updateDoc(doc(db, 'listings', listingId), {
          is_deactivated: deactivated,
          availability_status: nextAvailability,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `listings/${listingId}`);
      }
    }
    pushToast(
      deactivated ? 'warning' : 'success',
      deactivated
        ? `${target.listing_code} deactivated for new buyers. Existing active orders & period commitments must still be fulfilled.`
        : `${target.listing_code} reactivated for new orders.`
    );
    return true;
  };

  const activateListingForOrders: AliradaContextValue['activateListingForOrders'] = async (listingId) => {
    return deactivateListing(listingId, false);
  };

  const deleteListing: AliradaContextValue['deleteListing'] = async (id) => {
    if (!requireVerifiedAuth()) return false;
    const existing = listings.find((l) => l.id === id);
    if (!existing) return false;
    if (existing.obligation_status === 'HasObligations' && !isAdmin) {
      pushToast('error', 'Cannot delete listing with active orders. Use Deactivate instead.');
      return false;
    }
    setLocalListings((prev) => prev.filter((l) => l.id !== id));
    if (isLiveFirestore && firebaseUser && !SEED_IDS.listings.has(id)) {
      try {
        await deleteDoc(doc(db, 'listings', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `listings/${id}`);
      }
    }
    pushToast('success', 'Listing deleted.');
    return true;
  };

  const placeOrder: AliradaContextValue['placeOrder'] = async ({
    listing,
    quantity,
    google_map_link,
    notes,
    c2p_ref_code,
    c2p_payment_link,
    trigger_type,
    trigger_payload,
  }) => {
    if (!requireVerifiedAuth()) return null;
    if (listing.owner_uid === currentProfile.universal_id) {
      pushToast('error', 'Self-order prohibited: You cannot order your own listing.');
      return null;
    }
    if (getEffectiveListingAvailability(listing) === 'Deactivated') {
      pushToast('error', `${listing.listing_code} is deactivated and no longer accepts new orders.`);
      return null;
    }
    const cleanQty = Math.max(1, Math.round(quantity || 1));
    const totalPoints = Number((listing.price_points * cleanQty).toFixed(2));
    const myBalance = metricsMap[currentProfile.universal_id]?.balance ?? 0;
    if (myBalance - totalPoints < systemConfig.negative_points_floor) {
      pushToast(
        'error',
        `Order exceeds negative balance floor (${systemConfig.negative_points_floor} pts).`
      );
      return null;
    }
    const id = makeId('ord');
    const order: Order = {
      id,
      order_number: `ORD-${new Date().getFullYear()}-${String(orders.length + 510).padStart(4, '0')}`,
      order_date: todayIso(),
      buyer_uid: currentProfile.universal_id,
      buyer_auth_uid: firebaseUser?.uid || currentProfile.uid,
      seller_uid: listing.owner_uid,
      seller_auth_uid: listing.owner_auth_uid,
      listing_id: listing.id,
      listing_code: listing.listing_code,
      listing_type: listing.listing_type,
      quantity: cleanQty,
      total_points: totalPoints,
      payment_model: listing.payment_model,
      end_date: listing.end_date,
      google_map_link: sanitizeExternalLink(google_map_link),
      notes: notes?.trim() || '',
      order_status: 'Confirmed',
      delivery_status: 'Awaiting',
      c2p_ref_code: c2p_ref_code || '',
      c2p_payment_link: c2p_payment_link || '',
      trigger_type: trigger_type || '',
      trigger_payload: trigger_payload || '',
      obligation_status: 'HasObligations',
      created_at: new Date().toISOString(),
    };
    setLocalOrders((prev) => [order, ...prev]);
    setLocalListings((prev) =>
      prev.map((l) => (l.id === listing.id ? { ...l, obligation_status: 'HasObligations' } : l))
    );

    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'orders', id), {
          order_number: order.order_number,
          order_date: order.order_date,
          buyer_uid: order.buyer_uid,
          buyer_auth_uid: firebaseUser.uid,
          seller_uid: order.seller_uid,
          seller_auth_uid: order.seller_auth_uid,
          listing_id: order.listing_id,
          listing_code: order.listing_code,
          listing_type: order.listing_type,
          quantity: order.quantity,
          total_points: order.total_points,
          payment_model: order.payment_model,
          end_date: order.end_date || '',
          google_map_link: order.google_map_link || '',
          notes: order.notes || '',
          order_status: order.order_status,
          delivery_status: order.delivery_status,
          c2p_ref_code: order.c2p_ref_code || '',
          c2p_payment_link: order.c2p_payment_link || '',
          trigger_type: order.trigger_type || '',
          trigger_payload: order.trigger_payload || '',
          obligation_status: 'HasObligations',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (!SEED_IDS.listings.has(listing.id)) {
          await updateDoc(doc(db, 'listings', listing.id), {
            obligation_status: 'HasObligations',
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error('Place order Firestore error:', err);
        setLocalOrders((prev) => prev.filter((o) => o.id !== id));
        pushToast(
          'error',
          err instanceof Error ? `Order failed: ${err.message}` : 'Could not submit order.'
        );
        return null;
      }
    }
    pushToast('success', `Order ${order.order_number} confirmed (${totalPoints} pts).`);
    return order;
  };

  const confirmOrderDelivery: AliradaContextValue['confirmOrderDelivery'] = async ({
    order,
    status,
    evidence,
    notes,
    rejection_reason,
  }) => {
    if (!requireVerifiedAuth()) return false;
    const delId = makeId('del');
    const delRecord: Delivery = {
      id: delId,
      delivery_number: `DEL-${new Date().getFullYear()}-${String(deliveries.length + 101).padStart(4, '0')}`,
      order_id: order.id,
      receiver_uid: currentProfile.universal_id,
      receiver_auth_uid: firebaseUser?.uid || currentProfile.uid,
      seller_auth_uid: order.seller_auth_uid,
      delivery_evidence: sanitizeExternalLink(evidence),
      delivery_status: status,
      notes: notes?.trim() || '',
      rejection_reason: rejection_reason?.trim() || '',
      obligation_status: 'HasObligations',
      created_at: new Date().toISOString(),
    };
    setLocalDeliveries((prev) => [delRecord, ...prev]);

    const nextOrderStatus: Order['order_status'] =
      status === 'Delivered' ? 'Completed' : status === 'Rejected' ? 'Rejected' : 'Confirmed';

    setLocalOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              order_status: nextOrderStatus,
              delivery_status: status,
              rejection_reason: rejection_reason || o.rejection_reason,
            }
          : o
      )
    );

    // Proportional shareholder dividend settlement on Delivered (via linked_project_id or legacy listing_id)
    const dividendUpdates: { id: string; nextDividends: number }[] = [];
    if (status === 'Delivered') {
      const linkedListing = listings.find((l) => l.id === order.listing_id);
      const linkedProjectId = linkedListing?.linked_project_id;
      const targetInvs = investments.filter(
        (i) =>
          i.status === 'Active' &&
          ((linkedProjectId && (i.project_id === linkedProjectId || i.listing_id === linkedProjectId)) ||
            i.listing_id === order.listing_id)
      );
      if (targetInvs.length > 0) {
        const dividendPool = Number((order.total_points * 0.15).toFixed(2));
        const totalSharePct = targetInvs.reduce((acc, i) => acc + i.share_percentage, 0) || 100;
        targetInvs.forEach((inv) => {
          const shareRatio = inv.share_percentage / Math.max(totalSharePct, 100);
          const payout = Number((dividendPool * shareRatio).toFixed(2));
          dividendUpdates.push({
            id: inv.id,
            nextDividends: Number((inv.dividends_earned + payout).toFixed(2)),
          });
        });
        setLocalInvestments((prev) =>
          prev.map((inv) => {
            const upd = dividendUpdates.find((u) => u.id === inv.id);
            return upd ? { ...inv, dividends_earned: upd.nextDividends } : inv;
          })
        );
      }
    }

    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'deliveries', delId), {
          delivery_number: delRecord.delivery_number,
          order_id: delRecord.order_id,
          receiver_uid: delRecord.receiver_uid,
          receiver_auth_uid: firebaseUser.uid,
          seller_auth_uid: delRecord.seller_auth_uid,
          delivery_evidence: delRecord.delivery_evidence || '',
          delivery_status: delRecord.delivery_status,
          notes: delRecord.notes || '',
          rejection_reason: delRecord.rejection_reason || '',
          obligation_status: 'HasObligations',
          createdAt: serverTimestamp(),
        });
        if (!SEED_IDS.orders.has(order.id)) {
          await updateDoc(doc(db, 'orders', order.id), {
            order_status: nextOrderStatus,
            delivery_status: status,
            rejection_reason: rejection_reason || '',
            updatedAt: serverTimestamp(),
          });
        }
        for (const upd of dividendUpdates) {
          if (!SEED_IDS.investments.has(upd.id)) {
            await updateDoc(doc(db, 'investments', upd.id), {
              dividends_earned: upd.nextDividends,
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
      }
    }

    pushToast(
      status === 'Rejected' ? 'warning' : 'success',
      status === 'Delivered'
        ? `Delivery confirmed for ${order.order_number}. Seller settled & project dividends distributed.`
        : `Order ${order.order_number} marked ${status}.`
    );
    return true;
  };

  // Project Investments & Shareholder Reports
  const investInProject: AliradaContextValue['investInProject'] = async (project, amountPoints) => {
    if (!requireVerifiedAuth()) return false;
    if (!Number.isFinite(amountPoints) || amountPoints <= 0) {
      pushToast('error', 'Investment amount must be greater than zero.');
      return false;
    }
    if (project.investment_status === 'Deactivated' || project.investment_status === 'Closed') {
      pushToast('error', `Investment round for ${project.name} is ${project.investment_status}.`);
      return false;
    }
    const goal = project.investment_goal_points || 0;
    if (goal <= 0) {
      pushToast('error', 'This project does not have an open investment goal configured yet.');
      return false;
    }
    const myBalance = metricsMap[currentProfile.universal_id]?.balance ?? 0;
    if (myBalance - amountPoints < systemConfig.negative_points_floor) {
      pushToast(
        'error',
        `Investment exceeds negative balance floor (${systemConfig.negative_points_floor} pts).`
      );
      return false;
    }
    const sharePct = Number(Math.min(100, (amountPoints / goal) * 100).toFixed(2));
    const id = makeId('inv');
    const inv: Investment = {
      id,
      investment_code: `INV-${new Date().getFullYear()}-${String(investments.length + 10).padStart(3, '0')}`,
      investor_uid: currentProfile.universal_id,
      investor_auth_uid: firebaseUser?.uid || currentProfile.uid,
      project_id: project.id,
      project_code: project.project_code,
      listing_id: project.id,
      listing_code: project.project_code,
      target_type: 'Project Investment',
      invested_points: amountPoints,
      share_percentage: sharePct,
      budget_doc_link: project.budget_doc_url,
      presentation_link: project.presentation_url,
      dividends_earned: 0,
      status: 'Active',
      obligation_status: 'HasObligations',
      created_at: new Date().toISOString(),
    };
    setLocalInvestments((prev) => [inv, ...prev]);
    setLocalProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, obligation_status: 'HasObligations' } : p))
    );

    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'investments', id), {
          investment_code: inv.investment_code,
          investor_uid: inv.investor_uid,
          investor_auth_uid: firebaseUser.uid,
          project_id: inv.project_id,
          project_code: inv.project_code,
          listing_id: inv.listing_id,
          listing_code: inv.listing_code,
          target_type: inv.target_type,
          invested_points: inv.invested_points,
          share_percentage: inv.share_percentage,
          budget_doc_link: inv.budget_doc_link || '',
          presentation_link: inv.presentation_link || '',
          dividends_earned: 0,
          status: 'Active',
          obligation_status: 'HasObligations',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (!SEED_IDS.projects.has(project.id)) {
          await updateDoc(doc(db, 'projects', project.id), {
            obligation_status: 'HasObligations',
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error('Project investment Firestore error:', err);
        setLocalInvestments((prev) => prev.filter((item) => item.id !== id));
        pushToast(
          'error',
          err instanceof Error ? `Investment failed: ${err.message}` : 'Could not commit project investment.'
        );
        return false;
      }
    }
    pushToast('success', `Invested ${amountPoints} pts (${sharePct}% share) in project "${project.name}".`);
    return true;
  };

  const updateProjectInvestmentConfig: AliradaContextValue['updateProjectInvestmentConfig'] = async (
    projectId,
    patch
  ) => {
    if (!requireVerifiedAuth()) return false;
    const prj = projects.find((p) => p.id === projectId);
    if (!prj) return false;
    const isLeader =
      prj.owner_uid === currentProfile.universal_id ||
      prj.elected_ceo_uid === currentProfile.universal_id ||
      isAdmin;
    if (!isLeader) {
      pushToast('error', 'Only the Project Owner, Elected CEO, or Admin can update investment terms.');
      return false;
    }
    const cleanPatch = {
      ...(patch.investment_goal_points !== undefined
        ? { investment_goal_points: patch.investment_goal_points }
        : {}),
      ...(patch.budget_doc_url !== undefined
        ? { budget_doc_url: sanitizeExternalLink(patch.budget_doc_url) }
        : {}),
      ...(patch.presentation_url !== undefined
        ? { presentation_url: sanitizeExternalLink(patch.presentation_url) }
        : {}),
      ...(patch.investment_status !== undefined
        ? { investment_status: patch.investment_status }
        : {}),
    };
    setLocalProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...cleanPatch } : p)));
    if (isLiveFirestore && firebaseUser && !SEED_IDS.projects.has(projectId)) {
      try {
        await updateDoc(doc(db, 'projects', projectId), {
          ...cleanPatch,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`);
      }
    }
    pushToast('success', `Investment settings updated for ${prj.name}.`);
    return true;
  };

  const submitProjectInvestmentReport: AliradaContextValue['submitProjectInvestmentReport'] = async ({
    project,
    title,
    summary_text,
    links,
    period_cost_points,
    period_income_points,
  }) => {
    if (!requireVerifiedAuth()) return false;
    const isLeader =
      project.owner_uid === currentProfile.universal_id ||
      project.elected_ceo_uid === currentProfile.universal_id ||
      isAdmin;
    if (!isLeader) {
      pushToast('error', 'Only the Project Owner or Elected CEO can publish shareholder reports.');
      return false;
    }
    const cleanLinks = links
      .map((l) => ({
        label: l.label.trim().slice(0, 100) || 'Report Link',
        url: sanitizeExternalLink(l.url) || '',
      }))
      .filter((l) => l.url.length > 0);
    const existingReports = projectReports.filter((r) => r.project_id === project.id);
    const prevCost = existingReports.reduce((acc, r) => acc + r.period_cost_points, 0);
    const prevIncome = existingReports.reduce((acc, r) => acc + r.period_income_points, 0);
    const totalAccCost = Number((prevCost + period_cost_points).toFixed(2));
    const totalAccIncome = Number((prevIncome + period_income_points).toFixed(2));
    const id = makeId('prj_rep');
    const reportCode = `INV-RPT-${String(projectReports.length + 105)}`;
    const report: ProjectInvestmentReport = {
      id,
      report_code: reportCode,
      project_id: project.id,
      project_code: project.project_code,
      author_uid: currentProfile.universal_id,
      author_auth_uid: firebaseUser?.uid || currentProfile.uid,
      title: title.trim().slice(0, 160),
      summary_text: summary_text.trim().slice(0, 2000),
      links: cleanLinks,
      period_cost_points: Number(period_cost_points),
      period_income_points: Number(period_income_points),
      total_accumulated_cost: totalAccCost,
      total_accumulated_income: totalAccIncome,
      created_at: new Date().toISOString(),
    };
    setLocalProjectReports((prev) => [...prev, report]);

    // Notify every active shareholder of the project
    const activeShareholders = investments.filter(
      (i) => (i.project_id === project.id || i.listing_id === project.id) && i.status === 'Active'
    );
    const uniqueShareholders = new Map<string, string>();
    activeShareholders.forEach((inv) => {
      if (!uniqueShareholders.has(inv.investor_uid)) {
        uniqueShareholders.set(inv.investor_uid, inv.investor_auth_uid);
      }
    });

    const shareholderNotifications: PlatformNotification[] = [];
    uniqueShareholders.forEach((authUid, investorUid) => {
      shareholderNotifications.push({
        id: makeId('notif'),
        actor_uid: currentProfile.universal_id,
        target_uid: investorUid,
        target_auth_uid: authUid,
        title: `Shareholder Report · ${project.project_code}`,
        message: `${reportCode}: "${report.title}" · Cost +${report.period_cost_points} pts (Total ${totalAccCost}) · Income +${report.period_income_points} pts (Total ${totalAccIncome})`,
        is_admin_alert: false,
        read: false,
        created_at: new Date().toISOString(),
      });
    });
    if (shareholderNotifications.length > 0) {
      setLocalNotifications((prev) => [...shareholderNotifications, ...prev]);
    }

    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'project_investment_reports', id), {
          report_code: report.report_code,
          project_id: report.project_id,
          project_code: report.project_code,
          author_uid: report.author_uid,
          author_auth_uid: firebaseUser.uid,
          title: report.title,
          summary_text: report.summary_text,
          links: report.links,
          period_cost_points: report.period_cost_points,
          period_income_points: report.period_income_points,
          total_accumulated_cost: report.total_accumulated_cost,
          total_accumulated_income: report.total_accumulated_income,
          createdAt: serverTimestamp(),
        });
        for (const n of shareholderNotifications) {
          if (n.target_auth_uid) {
            await setDoc(doc(db, 'notifications', n.id), {
              actor_uid: n.actor_uid,
              target_uid: n.target_uid,
              target_auth_uid: n.target_auth_uid,
              title: n.title,
              message: n.message.slice(0, 500),
              is_admin_alert: false,
              read: false,
              createdAt: serverTimestamp(),
            }).catch(() => {});
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `project_investment_reports/${id}`);
      }
    }

    pushToast(
      'success',
      `Shareholder report ${reportCode} published & ${uniqueShareholders.size} shareholder(s) notified.`
    );
    return true;
  };

  // Projects & Employment
  const createProject: AliradaContextValue['createProject'] = async (payload) => {
    if (!requireVerifiedAuth()) return false;
    const id = makeId('prj');
    const goalPts = payload.investment_goal_points || 0;
    const prj: Project = {
      id,
      project_code: `PRJ-${new Date().getFullYear()}-${String(projects.length + 12)}`,
      owner_uid: currentProfile.universal_id,
      owner_auth_uid: firebaseUser?.uid || currentProfile.uid,
      elected_ceo_uid: currentProfile.universal_id,
      name: payload.name.trim(),
      category: payload.category,
      description: payload.description.trim(),
      visibility: payload.visibility,
      location: payload.location?.trim() || '',
      google_map_link: sanitizeExternalLink(payload.google_map_link),
      contact_info: payload.contact_info?.trim() || '',
      image_urls: ['/src/assets/images/listing_civic_academy_1795619024414.jpg'],
      entity_type: currentProfile.entity_type,
      investment_goal_points: goalPts > 0 ? goalPts : undefined,
      budget_doc_url: sanitizeExternalLink(payload.budget_doc_url),
      presentation_url: sanitizeExternalLink(payload.presentation_url),
      investment_status: goalPts > 0 ? 'Open' : undefined,
      delegates: [],
      members: [currentProfile.universal_id],
      join_requests: [],
      obligation_status: 'None',
      created_at: new Date().toISOString(),
    };
    setLocalProjects((prev) => [prj, ...prev]);

    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'projects', id), {
          project_code: prj.project_code,
          owner_uid: prj.owner_uid,
          owner_auth_uid: firebaseUser.uid,
          elected_ceo_uid: prj.elected_ceo_uid,
          name: prj.name,
          category: prj.category,
          description: prj.description,
          visibility: prj.visibility,
          location: prj.location || '',
          google_map_link: prj.google_map_link || '',
          contact_info: prj.contact_info || '',
          image_urls: prj.image_urls,
          entity_type: prj.entity_type || 'Individual',
          investment_goal_points: goalPts > 0 ? goalPts : 0,
          budget_doc_url: prj.budget_doc_url || '',
          presentation_url: prj.presentation_url || '',
          investment_status: goalPts > 0 ? 'Open' : 'Open',
          delegates: [],
          members: prj.members,
          join_requests: [],
          obligation_status: 'None',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `projects/${id}`);
      }
    }
    pushToast('success', `Project "${prj.name}" created.`);
    return true;
  };

  const joinOrRequestProject: AliradaContextValue['joinOrRequestProject'] = async (project) => {
    if (!requireVerifiedAuth()) return false;
    const myUid = currentProfile.universal_id;
    if (project.members.includes(myUid)) {
      pushToast('warning', 'You are already a member of this project.');
      return false;
    }
    const isPublic = project.visibility === 'Public';
    const nextMembers = isPublic ? [...project.members, myUid] : project.members;
    const nextRequests = isPublic
      ? project.join_requests
      : Array.from(new Set([...project.join_requests, myUid]));

    setLocalProjects((prev) =>
      prev.map((p) =>
        p.id === project.id ? { ...p, members: nextMembers, join_requests: nextRequests } : p
      )
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.projects.has(project.id)) {
      try {
        await updateDoc(doc(db, 'projects', project.id), {
          members: nextMembers,
          join_requests: nextRequests,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
      }
    }
    pushToast(
      'success',
      isPublic ? `Joined project "${project.name}".` : `Join request sent to "${project.name}".`
    );
    return true;
  };

  const approveProjectMember: AliradaContextValue['approveProjectMember'] = async (
    projectId,
    applicantUid
  ) => {
    if (!requireVerifiedAuth()) return;
    const prj = projects.find((p) => p.id === projectId);
    if (!prj) return;
    const nextMembers = Array.from(new Set([...prj.members, applicantUid]));
    const nextRequests = prj.join_requests.filter((u) => u !== applicantUid);
    setLocalProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, members: nextMembers, join_requests: nextRequests } : p
      )
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.projects.has(projectId)) {
      try {
        await updateDoc(doc(db, 'projects', projectId), {
          members: nextMembers,
          join_requests: nextRequests,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`);
      }
    }
    pushToast('success', `${applicantUid} approved as project member.`);
  };

  const addHierarchyItem: AliradaContextValue['addHierarchyItem'] = async (payload) => {
    if (!requireVerifiedAuth()) return false;
    const id = makeId('tsk');
    const item: ProjectHierarchyItem = {
      id,
      task_code: `TSK-${String(hierarchyItems.length + 103)}`,
      project_id: payload.project_id,
      creator_auth_uid: firebaseUser?.uid || currentProfile.uid,
      function_name: payload.function_name.trim(),
      step_title: payload.step_title?.trim() || undefined,
      fix_title: payload.fix_title?.trim() || undefined,
      description: payload.description?.trim() || '',
      estimated_cost: payload.estimated_cost || 0,
      doc_url: sanitizeExternalLink(payload.doc_url),
      video_url: sanitizeExternalLink(payload.video_url),
      image_url: sanitizeExternalLink(payload.image_url),
      resource_links: [],
      votes: { [currentProfile.universal_id]: 'Agree' },
      approval_status: 'Pending',
      assigned_uids: [],
      execution_status: 'Open',
      execution_reports: [],
      obligation_status: 'None',
      created_at: new Date().toISOString(),
    };
    setLocalHierarchy((prev) => [...prev, item]);
    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'project_hierarchy_items', id), {
          task_code: item.task_code,
          project_id: item.project_id,
          creator_auth_uid: firebaseUser.uid,
          function_name: item.function_name,
          step_title: item.step_title || '',
          fix_title: item.fix_title || '',
          description: item.description || '',
          estimated_cost: item.estimated_cost || 0,
          doc_url: item.doc_url || '',
          video_url: item.video_url || '',
          image_url: item.image_url || '',
          resource_links: [],
          votes: item.votes,
          approval_status: 'Pending',
          assigned_uids: [],
          execution_status: 'Open',
          execution_reports: [],
          obligation_status: 'None',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `project_hierarchy_items/${id}`);
      }
    }
    pushToast('success', `Added ${item.fix_title || item.step_title || item.function_name}.`);
    return true;
  };

  const voteHierarchyItem: AliradaContextValue['voteHierarchyItem'] = async (itemId, vote) => {
    if (!requireVerifiedAuth()) return;
    const item = hierarchyItems.find((i) => i.id === itemId);
    if (!item) return;
    const nextVotes: Record<string, 'Agree' | 'Disagree'> = {
      ...item.votes,
      [currentProfile.universal_id]: vote,
    };
    const agrees = Object.values(nextVotes).filter((v) => v === 'Agree').length;
    const disagrees = Object.values(nextVotes).filter((v) => v === 'Disagree').length;
    const nextStatus: ProjectHierarchyItem['approval_status'] =
      agrees >= 2 && agrees > disagrees
        ? 'Approved'
        : disagrees > agrees && disagrees >= 2
          ? 'Rejected'
          : 'Pending';

    setLocalHierarchy((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, votes: nextVotes, approval_status: nextStatus, obligation_status: 'HasObligations' }
          : i
      )
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.hierarchy.has(itemId)) {
      try {
        await updateDoc(doc(db, 'project_hierarchy_items', itemId), {
          votes: nextVotes,
          approval_status: nextStatus,
          obligation_status: 'HasObligations',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `project_hierarchy_items/${itemId}`);
      }
    }
    pushToast('success', `Recorded "${vote}" vote (${nextStatus}).`);
  };

  const assignHierarchyUids: AliradaContextValue['assignHierarchyUids'] = async (itemId, uids) => {
    if (!requireVerifiedAuth()) return;
    const targetItem = hierarchyItems.find((i) => i.id === itemId);
    const nextExecStatus =
      targetItem && uids.length > 0 && targetItem.execution_status === 'Open'
        ? 'In Progress'
        : targetItem?.execution_status || 'Open';
    setLocalHierarchy((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              assigned_uids: uids,
              execution_status: uids.length > 0 && i.execution_status === 'Open' ? 'In Progress' : i.execution_status,
              obligation_status: 'HasObligations',
            }
          : i
      )
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.hierarchy.has(itemId)) {
      try {
        await updateDoc(doc(db, 'project_hierarchy_items', itemId), {
          assigned_uids: uids,
          execution_status: nextExecStatus,
          obligation_status: 'HasObligations',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `project_hierarchy_items/${itemId}`);
      }
    }
    pushToast('success', 'Task assignees updated.');
  };

  const submitExecutionReport: AliradaContextValue['submitExecutionReport'] = async (
    item,
    project,
    hoursSpent,
    hardshipRating,
    summary
  ) => {
    if (!requireVerifiedAuth()) return false;
    const contextStr = [
      project.name,
      item.function_name,
      item.step_title,
      item.fix_title,
    ]
      .filter(Boolean)
      .join(' > ');

    const fallbackRecipient =
      profiles.find((p) => p.universal_id !== currentProfile.universal_id)?.universal_id || 'UID-2';
    const recipientUid =
      project.owner_uid === currentProfile.universal_id ? fallbackRecipient : project.owner_uid;

    const ok = await logService({
      recipient_uid: recipientUid,
      service_type: item.fix_title || item.step_title || item.function_name,
      hours: hoursSpent,
      hardship: hardshipRating,
      logged_date: todayIso(),
      project_context: contextStr,
      notes: summary,
    });
    if (!ok) return false;

    const reportEntry = {
      id: makeId('rep'),
      worker_uid: currentProfile.universal_id,
      hours_spent: hoursSpent,
      hardship_rating: hardshipRating,
      summary,
      logged_at: new Date().toISOString(),
    };

    const nextReports = [...item.execution_reports, reportEntry];
    setLocalHierarchy((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              hours_spent: (i.hours_spent || 0) + hoursSpent,
              hardship_rating: hardshipRating,
              execution_status: 'Executed',
              execution_reports: nextReports,
              obligation_status: 'HasObligations',
            }
          : i
      )
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.hierarchy.has(item.id)) {
      try {
        await updateDoc(doc(db, 'project_hierarchy_items', item.id), {
          hours_spent: (item.hours_spent || 0) + hoursSpent,
          hardship_rating: hardshipRating,
          execution_status: 'Executed',
          execution_reports: nextReports,
          obligation_status: 'HasObligations',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `project_hierarchy_items/${item.id}`);
      }
    }
    return true;
  };

  const createJobPosting: AliradaContextValue['createJobPosting'] = async (payload) => {
    if (!requireVerifiedAuth()) return false;
    const id = makeId('job');
    const job: EmploymentPosting = {
      id,
      job_code: `JOB-${new Date().getFullYear()}-${String(employmentPostings.length + 10)}`,
      project_id: payload.project_id,
      poster_uid: currentProfile.universal_id,
      poster_auth_uid: firebaseUser?.uid || currentProfile.uid,
      position_title: payload.position_title.trim(),
      qualifications: payload.qualifications.trim(),
      tasks_summary: payload.tasks_summary.trim(),
      required_course_ids: payload.required_course_ids,
      location: payload.location.trim(),
      status: 'Open',
      applicants: [],
      invites: [],
      obligation_status: 'None',
      created_at: new Date().toISOString(),
    };
    setLocalEmployment((prev) => [job, ...prev]);
    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'employment_postings', id), {
          job_code: job.job_code,
          project_id: job.project_id,
          poster_uid: job.poster_uid,
          poster_auth_uid: firebaseUser.uid,
          position_title: job.position_title,
          qualifications: job.qualifications || '',
          tasks_summary: job.tasks_summary || '',
          required_course_ids: job.required_course_ids,
          location: job.location || '',
          status: 'Open',
          applicants: [],
          invites: [],
          obligation_status: 'None',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `employment_postings/${id}`);
      }
    }
    pushToast('success', `Employment posting "${job.position_title}" published.`);
    return true;
  };

  const applyToJob: AliradaContextValue['applyToJob'] = async (jobId, contactNumber, cvLink) => {
    if (!requireVerifiedAuth()) return false;
    const job = employmentPostings.find((j) => j.id === jobId);
    if (!job) return false;
    const cleanCv = sanitizeExternalLink(cvLink);
    if (!cleanCv) {
      pushToast('error', 'Please enter a valid CV link (https://...).');
      return false;
    }
    const nextApplicants = [
      ...job.applicants.filter((a) => a.uid !== currentProfile.universal_id),
      {
        uid: currentProfile.universal_id,
        full_name: currentProfile.full_name,
        contact_number: contactNumber.trim(),
        cv_link: cleanCv,
        applied_at: new Date().toISOString(),
        status: 'Applied' as const,
      },
    ];
    setLocalEmployment((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, applicants: nextApplicants, obligation_status: 'HasObligations' } : j
      )
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.jobs.has(jobId)) {
      try {
        await updateDoc(doc(db, 'employment_postings', jobId), {
          applicants: nextApplicants,
          obligation_status: 'HasObligations',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `employment_postings/${jobId}`);
      }
    }
    pushToast('success', `Application submitted for ${job.position_title}.`);
    return true;
  };

  const inviteToJob: AliradaContextValue['inviteToJob'] = async (jobId, targetUid) => {
    if (!requireVerifiedAuth()) return;
    const job = employmentPostings.find((j) => j.id === jobId);
    if (!job) return;
    const normalizedUid = targetUid.trim().toUpperCase();
    const nextInvites = [
      ...job.invites.filter((i) => i.uid !== normalizedUid),
      { uid: normalizedUid, invited_at: new Date().toISOString(), status: 'Invited' as const },
    ];
    setLocalEmployment((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, invites: nextInvites } : j))
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.jobs.has(jobId)) {
      try {
        await updateDoc(doc(db, 'employment_postings', jobId), {
          invites: nextInvites,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `employment_postings/${jobId}`);
      }
    }
    pushToast('success', `Invited ${normalizedUid} to ${job.position_title}.`);
  };

  const updateJobApplicantStatus: AliradaContextValue['updateJobApplicantStatus'] = async (
    jobId,
    applicantUid,
    status
  ) => {
    if (!requireVerifiedAuth()) return false;
    const job = employmentPostings.find((j) => j.id === jobId);
    if (!job) return false;
    const nextApplicants = job.applicants.map((a) =>
      a.uid === applicantUid ? { ...a, status } : a
    );
    const nextJobStatus = status === 'Accepted' ? 'Filled' : job.status;
    setLocalEmployment((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              applicants: nextApplicants,
              status: nextJobStatus,
              obligation_status: 'HasObligations',
            }
          : j
      )
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.jobs.has(jobId)) {
      try {
        await updateDoc(doc(db, 'employment_postings', jobId), {
          applicants: nextApplicants,
          status: nextJobStatus,
          obligation_status: 'HasObligations',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `employment_postings/${jobId}`);
      }
    }
    if (status === 'Accepted') {
      const prj = projects.find((p) => p.id === job.project_id);
      if (prj && !prj.members.includes(applicantUid)) {
        const nextMembers = Array.from(new Set([...prj.members, applicantUid]));
        setLocalProjects((prev) =>
          prev.map((p) => (p.id === prj.id ? { ...p, members: nextMembers } : p))
        );
        if (isLiveFirestore && firebaseUser && !SEED_IDS.projects.has(prj.id)) {
          try {
            await updateDoc(doc(db, 'projects', prj.id), {
              members: nextMembers,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `projects/${prj.id}`);
          }
        }
      }
    }
    pushToast('success', `Applicant ${applicantUid} marked ${status}.`);
    return true;
  };

  // Payments, Batches & Point Exchange
  const issueTransactionRef: AliradaContextValue['issueTransactionRef'] = async (payload) => {
    if (!requireVerifiedAuth()) return null;
    const refCode = `${payload.ref_type}-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const linkedListing =
      payload.ref_type === 'C2P' && payload.linked_listing_code
        ? listings.find((l) => l.listing_code === payload.linked_listing_code)
        : undefined;
    const lockedAmount =
      linkedListing && payload.ref_type === 'C2P'
        ? linkedListing.price_points
        : Number(payload.points_amount);
    const initialStatus: TransactionRef['status'] = payload.ref_type === 'C2P' ? 'Open' : 'Pending';
    const issuerAuthUid = firebaseUser?.uid || currentProfile.uid;

    const record: TransactionRef = {
      id: refCode,
      ref_code: refCode,
      ref_type: payload.ref_type,
      issuer_uid: currentProfile.universal_id,
      issuer_auth_uid: issuerAuthUid,
      participant_auth_uids: [issuerAuthUid],
      linked_listing_code: payload.linked_listing_code || '',
      widget_name: payload.widget_name || (linkedListing ? linkedListing.title : ''),
      points_amount: lockedAmount,
      payment_model: linkedListing ? linkedListing.payment_model : payload.payment_model,
      end_date: linkedListing?.end_date || payload.end_date || '',
      description: payload.description || '',
      trigger_type: payload.trigger_type,
      trigger_payload: sanitizeExternalLink(payload.trigger_payload) || payload.trigger_payload || '',
      status: initialStatus,
      is_deactivated: false,
      payments_count: 0,
      c2p_settlements: [],
      obligation_status: 'None',
      created_at: new Date().toISOString(),
    };
    setLocalRefs((prev) => [record, ...prev]);

    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'transaction_refs', refCode), {
          ref_code: record.ref_code,
          ref_type: record.ref_type,
          issuer_uid: record.issuer_uid,
          issuer_auth_uid: firebaseUser.uid,
          participant_auth_uids: [firebaseUser.uid],
          linked_listing_code: record.linked_listing_code || '',
          widget_name: record.widget_name || '',
          points_amount: record.points_amount,
          payment_model: record.payment_model,
          end_date: record.end_date || '',
          description: record.description || '',
          trigger_type: record.trigger_type,
          trigger_payload: record.trigger_payload || '',
          status: initialStatus,
          is_deactivated: false,
          payments_count: 0,
          c2p_settlements: [],
          obligation_status: 'None',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `transaction_refs/${refCode}`);
      }
    }
    pushToast(
      'success',
      payload.ref_type === 'C2P'
        ? `Open C2P Reference ${refCode} (${lockedAmount} pts) issued. Stays open until you cancel or deactivate it.`
        : `P2P Reference ${refCode} issued.`
    );
    return record;
  };

  const redeemTransactionRef: AliradaContextValue['redeemTransactionRef'] = async (
    refCode,
    quantity = 1,
    orderDetails
  ) => {
    if (!requireVerifiedAuth()) {
      return { ok: false, message: 'Please sign in with a verified email account first.' };
    }
    const code = refCode.trim().toUpperCase();
    let ref = transactionRefs.find((r) => r.ref_code === code);
    if (!ref && isLiveFirestore) {
      try {
        const snap = await getDoc(doc(db, 'transaction_refs', code));
        if (snap.exists()) {
          ref = { ...(snap.data() as TransactionRef), id: snap.id };
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `transaction_refs/${code}`);
      }
    }
    if (!ref) {
      return { ok: false, message: 'Reference code not found.' };
    }
    if (ref.status === 'Deactivated' || ref.status === 'Cancelled' || ref.is_deactivated) {
      return { ok: false, message: `Reference ${code} is ${ref.status} and closed for new payments.` };
    }
    if (ref.ref_type === 'P2P' && ref.status !== 'Pending') {
      return { ok: false, message: `P2P Reference ${code} is already ${ref.status}.` };
    }
    if (ref.ref_type === 'C2P' && ref.status !== 'Open' && ref.status !== 'Pending') {
      return { ok: false, message: `C2P Reference ${code} is ${ref.status}.` };
    }
    if (ref.issuer_uid === currentProfile.universal_id) {
      return {
        ok: false,
        message: 'Self-redemption prohibited: You cannot pay or redeem your own issued reference.',
      };
    }

    const linkedOrderListing = ref.linked_listing_code
      ? listings.find((l) => l.listing_code === ref?.linked_listing_code)
      : undefined;

    if (linkedOrderListing && getEffectiveListingAvailability(linkedOrderListing) === 'Deactivated') {
      return {
        ok: false,
        message: `Listing ${linkedOrderListing.listing_code} is deactivated and cannot accept new orders.`,
      };
    }

    const cleanQty = Math.max(1, Math.round(quantity || 1));
    const unitPoints = linkedOrderListing ? linkedOrderListing.price_points : ref.points_amount;
    const settledPoints = Number((unitPoints * cleanQty).toFixed(2));
    const myBalance = metricsMap[currentProfile.universal_id]?.balance ?? 0;

    if (ref.ref_type === 'C2P' && myBalance - settledPoints < systemConfig.negative_points_floor) {
      return {
        ok: false,
        message: `Payment exceeds negative balance floor (${systemConfig.negative_points_floor} pts).`,
      };
    }

    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://alirada.com';
    const payLink = `${origin}/?pay_ref=${encodeURIComponent(code)}`;

    // Create linked Order whenever C2P is connected to a Marketplace Listing
    let createdOrder: Order | null = null;
    if (linkedOrderListing && linkedOrderListing.owner_uid !== currentProfile.universal_id) {
      createdOrder = await placeOrder({
        listing: linkedOrderListing,
        quantity: cleanQty,
        google_map_link: orderDetails?.google_map_link,
        notes: orderDetails?.notes || `Settled via C2P reference ${code}`,
        c2p_ref_code: code,
        c2p_payment_link: payLink,
        trigger_type: ref.trigger_type,
        trigger_payload: ref.trigger_payload,
      });
      if (!createdOrder) {
        return {
          ok: false,
          message: 'Could not create linked Marketplace order for this C2P payment.',
        };
      }
    }

    const confirmedAt = new Date().toISOString();
    const payerAuthUid = firebaseUser?.uid || currentProfile.uid;
    const nextParticipants = Array.from(
      new Set([...(ref.participant_auth_uids || [ref.issuer_auth_uid]), payerAuthUid])
    );

    const newSettlement: C2PSettlementRecord = {
      payer_uid: currentProfile.universal_id,
      payer_auth_uid: payerAuthUid,
      payer_email: currentProfile.email || '',
      points_amount: settledPoints,
      order_id: createdOrder?.id || '',
      order_number: createdOrder?.order_number || '',
      paid_at: confirmedAt,
    };

    const nextSettlements = [...(ref.c2p_settlements || []), newSettlement];
    const nextStatus: TransactionRef['status'] = ref.ref_type === 'C2P' ? 'Open' : 'Confirmed';
    const nextPaymentsCount = (ref.payments_count || 0) + 1;

    setLocalRefs((prev) =>
      prev.map((r) =>
        r.ref_code === code
          ? {
              ...r,
              counterparty_uid: currentProfile.universal_id,
              counterparty_auth_uid: payerAuthUid,
              participant_auth_uids: nextParticipants,
              linked_order_id: createdOrder?.id || r.linked_order_id,
              payer_email: currentProfile.email || '',
              status: nextStatus,
              payments_count: nextPaymentsCount,
              last_paid_by_uid: currentProfile.universal_id,
              c2p_settlements: nextSettlements,
              confirmed_at: confirmedAt,
              obligation_status: 'HasObligations',
            }
          : r
      )
    );

    if (isLiveFirestore && firebaseUser && !SEED_IDS.refs.has(code)) {
      try {
        await updateDoc(doc(db, 'transaction_refs', code), {
          counterparty_uid: currentProfile.universal_id,
          counterparty_auth_uid: firebaseUser.uid,
          participant_auth_uids: nextParticipants,
          linked_order_id: createdOrder?.id || ref.linked_order_id || '',
          payer_email: currentProfile.email || firebaseUser.email || '',
          status: nextStatus,
          payments_count: nextPaymentsCount,
          last_paid_by_uid: currentProfile.universal_id,
          c2p_settlements: nextSettlements,
          confirmed_at: confirmedAt,
          obligation_status: 'HasObligations',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `transaction_refs/${code}`);
      }
    }

    // Execute post-payment website / embed API triggers safely
    const triggerEventPayload = {
      type: 'ALIRADA_C2P_PAYMENT_CONFIRMED',
      ref_code: code,
      ref_type: ref.ref_type,
      points_amount: settledPoints,
      issuer_uid: ref.issuer_uid,
      payer_uid: currentProfile.universal_id,
      listing_code: ref.linked_listing_code || '',
      order_id: createdOrder?.id || '',
      order_number: createdOrder?.order_number || '',
      trigger_type: ref.trigger_type,
      trigger_payload: ref.trigger_payload || '',
      paid_at: confirmedAt,
    };

    if (typeof window !== 'undefined') {
      try {
        window.postMessage(triggerEventPayload, '*');
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(triggerEventPayload, '*');
        }
      } catch {
        // non-fatal postMessage error
      }
      if (ref.trigger_type === 'Webhook/Notification' && ref.trigger_payload) {
        const cleanHook = sanitizeExternalLink(ref.trigger_payload);
        if (cleanHook) {
          fetch(cleanHook, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(triggerEventPayload),
          }).catch(() => {});
        }
      }
    }

    pushToast(
      'success',
      createdOrder
        ? `Paid ${settledPoints} pts via ${code} · Order ${createdOrder.order_number} created.`
        : `Reference ${code} settled (${settledPoints} pts).`
    );
    return {
      ok: true,
      ref: {
        ...ref,
        status: nextStatus,
        payments_count: nextPaymentsCount,
        c2p_settlements: nextSettlements,
      },
      order: createdOrder || undefined,
      settledPoints,
      triggerExecuted:
        ref.trigger_type !== 'None'
          ? { type: ref.trigger_type, payload: ref.trigger_payload }
          : undefined,
      message: createdOrder
        ? `Confirmed ${settledPoints} pts & created order ${createdOrder.order_number}.`
        : `Confirmed ${settledPoints} pts via ${code}.`,
    };
  };

  const deactivateTransactionRef: AliradaContextValue['deactivateTransactionRef'] = async (
    id,
    nextStatus
  ) => {
    if (!requireVerifiedAuth()) return false;
    const existing = transactionRefs.find((r) => r.id === id);
    if (!existing) return false;
    if (existing.issuer_uid !== currentProfile.universal_id && !isAdmin) {
      pushToast('error', 'Only the reference issuer or administrator can deactivate or cancel it.');
      return false;
    }
    const isDeactivated = nextStatus === 'Deactivated' || nextStatus === 'Cancelled';
    setLocalRefs((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: nextStatus, is_deactivated: isDeactivated } : r
      )
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.refs.has(id)) {
      try {
        await updateDoc(doc(db, 'transaction_refs', id), {
          status: nextStatus,
          is_deactivated: isDeactivated,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `transaction_refs/${id}`);
      }
    }
    pushToast(
      'warning',
      `${existing.ref_code} marked ${nextStatus}. Existing paid orders & active period commitments must still be fulfilled.`
    );
    return true;
  };

  const deleteTransactionRef: AliradaContextValue['deleteTransactionRef'] = async (id) => {
    if (!requireVerifiedAuth()) return false;
    const existing = transactionRefs.find((r) => r.id === id);
    if (!existing) return false;
    if (existing.obligation_status === 'HasObligations' && !isAdmin) {
      pushToast('error', 'References with prior payments cannot be deleted. Cancel or deactivate instead.');
      return false;
    }
    setLocalRefs((prev) => prev.filter((r) => r.id !== id));
    if (isLiveFirestore && firebaseUser && !SEED_IDS.refs.has(id)) {
      try {
        await deleteDoc(doc(db, 'transaction_refs', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `transaction_refs/${id}`);
      }
    }
    pushToast('success', 'Reference removed.');
    return true;
  };

  const saveBatchPayment: AliradaContextValue['saveBatchPayment'] = async (payload) => {
    if (!requireVerifiedAuth()) return false;
    const id = payload.id || makeId('bat');
    const existing = batchPayments.find((b) => b.id === id);
    if (existing && existing.obligation_status === 'HasObligations' && !isAdmin) {
      pushToast('error', 'Already-sent batches cannot be edited directly. Create a new batch or re-send.');
      return false;
    }
    const batch: BatchPayment = {
      id,
      batch_code: existing?.batch_code || `BAT-${new Date().getFullYear()}-${String(batchPayments.length + 12)}`,
      creator_uid: currentProfile.universal_id,
      creator_auth_uid: firebaseUser?.uid || currentProfile.uid,
      batch_name: payload.batch_name.trim(),
      recipients: payload.recipients,
      scheduled_time: payload.scheduled_time || '',
      recurrence: payload.recurrence,
      notes: payload.notes || '',
      send_count: existing?.send_count || 0,
      status: payload.scheduled_time ? 'Scheduled' : 'Draft',
      obligation_status: existing?.obligation_status || 'None',
      created_at: existing?.created_at || new Date().toISOString(),
    };
    setLocalBatches((prev) => [batch, ...prev.filter((b) => b.id !== id)]);
    if (isLiveFirestore && firebaseUser && !SEED_IDS.batches.has(id)) {
      try {
        const batchRef = doc(db, 'batch_payments', id);
        const snap = await getDoc(batchRef);
        if (snap.exists()) {
          await updateDoc(batchRef, {
            batch_name: batch.batch_name,
            recipients: batch.recipients,
            scheduled_time: batch.scheduled_time || '',
            recurrence: batch.recurrence,
            notes: batch.notes || '',
            status: batch.status,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(batchRef, {
            batch_code: batch.batch_code,
            creator_uid: batch.creator_uid,
            creator_auth_uid: firebaseUser.uid,
            batch_name: batch.batch_name,
            recipients: batch.recipients,
            scheduled_time: batch.scheduled_time || '',
            recurrence: batch.recurrence,
            notes: batch.notes || '',
            send_count: batch.send_count,
            status: batch.status,
            obligation_status: batch.obligation_status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `batch_payments/${id}`);
      }
    }
    pushToast('success', `Batch "${batch.batch_name}" saved.`);
    return true;
  };

  const sendBatchPayment: AliradaContextValue['sendBatchPayment'] = async (batchId) => {
    if (!requireVerifiedAuth()) return false;
    const batch = batchPayments.find((b) => b.id === batchId);
    if (!batch) return false;
    const totalBatchPts = batch.recipients.reduce((acc, r) => acc + r.points, 0);
    const myBal = metricsMap[currentProfile.universal_id]?.balance ?? 0;
    if (myBal - totalBatchPts < systemConfig.negative_points_floor) {
      pushToast('error', 'Batch exceeds negative points floor.');
      return false;
    }
    const nowIso = new Date().toISOString();
    const nextCount = batch.send_count + 1;
    setLocalBatches((prev) =>
      prev.map((b) =>
        b.id === batchId
          ? { ...b, send_count: nextCount, last_sent_at: nowIso, status: 'Sent', obligation_status: 'HasObligations' }
          : b
      )
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.batches.has(batchId)) {
      try {
        await updateDoc(doc(db, 'batch_payments', batchId), {
          send_count: nextCount,
          last_sent_at: nowIso,
          status: 'Sent',
          obligation_status: 'HasObligations',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `batch_payments/${batchId}`);
      }
    }
    pushToast('success', `Batch "${batch.batch_name}" disbursed (${totalBatchPts} pts to ${batch.recipients.length} recipients).`);
    return true;
  };

  const deleteBatchPayment: AliradaContextValue['deleteBatchPayment'] = async (batchId) => {
    if (!requireVerifiedAuth()) return false;
    const batch = batchPayments.find((b) => b.id === batchId);
    if (!batch) return false;
    if (batch.obligation_status === 'HasObligations' && !isAdmin) {
      pushToast('error', 'Cannot delete a batch that has already been sent.');
      return false;
    }
    setLocalBatches((prev) => prev.filter((b) => b.id !== batchId));
    if (isLiveFirestore && firebaseUser && !SEED_IDS.batches.has(batchId)) {
      try {
        await deleteDoc(doc(db, 'batch_payments', batchId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `batch_payments/${batchId}`);
      }
    }
    pushToast('success', 'Batch payment deleted.');
    return true;
  };

  const createPointExchange: AliradaContextValue['createPointExchange'] = async (
    pointsRequested,
    cashAmount,
    currency,
    notes
  ) => {
    if (!requireVerifiedAuth()) return false;
    const myBal = metricsMap[currentProfile.universal_id]?.balance ?? 0;
    if (myBal - pointsRequested < systemConfig.negative_points_floor) {
      pushToast('error', 'Insufficient point headroom to lock escrow.');
      return false;
    }
    const id = makeId('exc');
    const exc: PointExchange = {
      id,
      exchange_code: `EXC-${new Date().getFullYear()}-${String(pointExchanges.length + 10).padStart(3, '0')}`,
      seller_uid: currentProfile.universal_id,
      seller_auth_uid: firebaseUser?.uid || currentProfile.uid,
      points_requested: pointsRequested,
      cash_amount: cashAmount,
      currency,
      status: 'Escrow Locked',
      notes: notes || '',
      obligation_status: 'None',
      created_at: new Date().toISOString(),
    };
    setLocalExchanges((prev) => [exc, ...prev]);
    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'point_exchanges', id), {
          exchange_code: exc.exchange_code,
          seller_uid: exc.seller_uid,
          seller_auth_uid: firebaseUser.uid,
          points_requested: exc.points_requested,
          cash_amount: exc.cash_amount,
          currency: exc.currency,
          status: 'Escrow Locked',
          notes: exc.notes || '',
          obligation_status: 'None',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `point_exchanges/${id}`);
      }
    }
    pushToast('success', `Locked ${pointsRequested} pts in escrow (${exc.exchange_code}).`);
    return true;
  };

  const submitExchangeProof: AliradaContextValue['submitExchangeProof'] = async (
    exchangeId,
    paymentProof
  ) => {
    if (!requireVerifiedAuth()) return false;
    const exc = pointExchanges.find((e) => e.id === exchangeId);
    if (!exc) return false;
    if (exc.seller_uid === currentProfile.universal_id) {
      pushToast('error', 'You cannot buy your own point exchange listing.');
      return false;
    }
    setLocalExchanges((prev) =>
      prev.map((e) =>
        e.id === exchangeId
          ? {
              ...e,
              buyer_uid: currentProfile.universal_id,
              buyer_auth_uid: firebaseUser?.uid || currentProfile.uid,
              payment_proof: paymentProof,
              status: 'Proof Submitted',
              obligation_status: 'HasObligations',
            }
          : e
      )
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.exchanges.has(exchangeId)) {
      try {
        await updateDoc(doc(db, 'point_exchanges', exchangeId), {
          buyer_uid: currentProfile.universal_id,
          buyer_auth_uid: firebaseUser.uid,
          payment_proof: paymentProof,
          status: 'Proof Submitted',
          obligation_status: 'HasObligations',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `point_exchanges/${exchangeId}`);
      }
    }
    pushToast('success', 'Cash payment proof submitted for seller release.');
    return true;
  };

  const releasePointExchange: AliradaContextValue['releasePointExchange'] = async (exchangeId) => {
    if (!requireVerifiedAuth()) return false;
    setLocalExchanges((prev) =>
      prev.map((e) => (e.id === exchangeId ? { ...e, status: 'Released' } : e))
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.exchanges.has(exchangeId)) {
      try {
        await updateDoc(doc(db, 'point_exchanges', exchangeId), {
          status: 'Released',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `point_exchanges/${exchangeId}`);
      }
    }
    pushToast('success', 'Escrow released to buyer.');
    return true;
  };

  const deactivatePointExchange: AliradaContextValue['deactivatePointExchange'] = async (exchangeId) => {
    if (!requireVerifiedAuth()) return false;
    const exc = pointExchanges.find((e) => e.id === exchangeId);
    if (!exc) return false;
    if (exc.status !== 'Escrow Locked') {
      pushToast(
        'error',
        'Only Escrow Locked exchanges without an active cash proof can be deactivated. Proof Submitted exchanges must be fulfilled.'
      );
      return false;
    }
    if (exc.seller_uid !== currentProfile.universal_id && !isAdmin) {
      pushToast('error', 'Only the escrow seller or administrator can deactivate this exchange.');
      return false;
    }
    setLocalExchanges((prev) =>
      prev.map((e) =>
        e.id === exchangeId ? { ...e, status: 'Deactivated', is_deactivated: true } : e
      )
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.exchanges.has(exchangeId)) {
      try {
        await updateDoc(doc(db, 'point_exchanges', exchangeId), {
          status: 'Deactivated',
          is_deactivated: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `point_exchanges/${exchangeId}`);
      }
    }
    pushToast('success', `Exchange ${exc.exchange_code} deactivated and escrowed points unlocked.`);
    return true;
  };

  const cancelPointExchange: AliradaContextValue['cancelPointExchange'] = async (exchangeId) => {
    return deactivatePointExchange(exchangeId);
  };

  // Governance & Reports & Admin
  const saveGovernanceDelegate: AliradaContextValue['saveGovernanceDelegate'] = async (payload) => {
    if (!requireVerifiedAuth()) return false;
    const id = makeId('gov');
    const rec: GovernanceDelegate = {
      id,
      scope: payload.scope,
      principal_uid: currentProfile.universal_id,
      principal_auth_uid: firebaseUser?.uid || currentProfile.uid,
      entity_name: payload.entity_name.trim(),
      delegate_email: payload.delegate_email.trim(),
      delegate_uid: payload.delegate_uid?.trim() || '',
      delegated_tasks: payload.delegated_tasks,
      ceo_votes: [],
      successor_email: payload.successor_email?.trim() || '',
      absent_period_days: payload.absent_period_days,
      updated_at: new Date().toISOString(),
    };
    setLocalGov((prev) => [rec, ...prev]);
    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'governance_delegates', id), {
          scope: rec.scope,
          principal_uid: rec.principal_uid,
          principal_auth_uid: firebaseUser.uid,
          entity_name: rec.entity_name,
          delegate_email: rec.delegate_email,
          delegate_uid: rec.delegate_uid || '',
          delegated_tasks: rec.delegated_tasks,
          ceo_votes: rec.ceo_votes,
          successor_email: rec.successor_email || '',
          absent_period_days: rec.absent_period_days,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `governance_delegates/${id}`);
      }
    }
    pushToast(
      'success',
      payload.scope === 'PLATFORM' && !isRootAdmin
        ? 'Platform charter saved. Note: Super Admin Console delegation must be granted by amrelyon@gmail.com in the Admin Console.'
        : `${payload.scope} delegation record saved.`
    );
    return true;
  };

  const voteForCeo: AliradaContextValue['voteForCeo'] = async (governanceId, candidateUid) => {
    if (!requireVerifiedAuth()) return;
    const gov = governanceDelegates.find((g) => g.id === governanceId);
    if (!gov) return;
    const myUid = currentProfile.universal_id;
    const filtered = gov.ceo_votes.filter((v) => !v.startsWith(`${myUid}:`));
    const nextVotes = [...filtered, `${myUid}:${candidateUid}`];
    setLocalGov((prev) =>
      prev.map((g) => (g.id === governanceId ? { ...g, ceo_votes: nextVotes } : g))
    );
    if (isLiveFirestore && firebaseUser && !SEED_IDS.gov.has(governanceId)) {
      try {
        await updateDoc(doc(db, 'governance_delegates', governanceId), {
          ceo_votes: nextVotes,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `governance_delegates/${governanceId}`);
      }
    }
    pushToast('success', `CEO vote updated to ${candidateUid}.`);
  };

  const submitUserReport: AliradaContextValue['submitUserReport'] = async (
    targetType,
    targetId,
    reason,
    options
  ) => {
    if (!requireVerifiedAuth()) return false;
    const id = makeId('rpt');
    const report: UserReport = {
      id,
      report_code: `RPT-${new Date().getFullYear()}-${String(userReports.length + 10)}`,
      reporter_uid: currentProfile.universal_id,
      reporter_auth_uid: firebaseUser?.uid || currentProfile.uid,
      reporter_email: currentProfile.email || firebaseUser?.email || 'member@alirada.org',
      reported_uid: options?.reportedUid || '',
      target_type: targetType,
      target_id: targetId,
      target_snapshot: options?.snapshot?.slice(0, 1500) || '',
      reason: reason.trim(),
      admin_comment: '',
      admin_action_taken: '',
      status: 'Open',
      created_at: new Date().toISOString(),
    };
    setLocalReports((prev) => [report, ...prev]);
    if (isLiveFirestore && firebaseUser) {
      try {
        await setDoc(doc(db, 'user_reports', id), {
          report_code: report.report_code,
          reporter_uid: report.reporter_uid || '',
          reporter_auth_uid: firebaseUser.uid,
          reporter_email: report.reporter_email,
          reported_uid: report.reported_uid || '',
          target_type: report.target_type,
          target_id: report.target_id,
          target_snapshot: report.target_snapshot || '',
          reason: report.reason,
          admin_comment: '',
          admin_action_taken: '',
          status: 'Open',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `user_reports/${id}`);
      }
    }
    await emitAdminAlert(
      'New User Report',
      `${report.reporter_uid || 'Member'} reported ${report.target_type} (${report.target_id}${report.reported_uid ? ` · UID ${report.reported_uid}` : ''}): ${report.reason}`
    );
    pushToast('success', `Report ${report.report_code} submitted with examined data for admin review.`);
    return true;
  };

  const resolveUserReport: AliradaContextValue['resolveUserReport'] = async (
    reportId,
    status,
    adminComment,
    actionTaken
  ) => {
    if (!requireVerifiedAuth() || !isAdmin) return;
    setLocalReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              status,
              ...(adminComment !== undefined ? { admin_comment: adminComment } : {}),
              ...(actionTaken !== undefined ? { admin_action_taken: actionTaken } : {}),
            }
          : r
      )
    );
    if (isLiveFirestore && firebaseUser && isAdmin) {
      try {
        await updateDoc(doc(db, 'user_reports', reportId), {
          status,
          ...(adminComment !== undefined ? { admin_comment: adminComment.slice(0, 1000) } : {}),
          ...(actionTaken !== undefined ? { admin_action_taken: actionTaken.slice(0, 160) } : {}),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `user_reports/${reportId}`);
      }
    }
    pushToast('success', `Report updated (${status}).`);
  };

  const updateSystemConfig: AliradaContextValue['updateSystemConfig'] = async (patch) => {
    if (!requireVerifiedAuth() || !isAdmin) return;
    const next = { ...systemConfig, ...patch };
    setSystemConfig(next);
    if (isLiveFirestore && firebaseUser && isAdmin) {
      try {
        await setDoc(
          doc(db, 'system_config', 'platform'),
          {
            key: 'platform',
            value: next,
            category: 'governance',
            description: 'Global Alirada platform settings',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'system_config/platform');
      }
    }
    pushToast('success', 'System configuration updated.');
  };

  const applyAdminDiscipline: AliradaContextValue['applyAdminDiscipline'] = async (
    targetProfileId,
    action,
    penaltyPoints = 0,
    reason = ''
  ) => {
    if (!requireVerifiedAuth() || !isAdmin) return;
    const target = profiles.find((p) => p.id === targetProfileId);
    if (!target) return;
    const nextStatus: AliradaProfile['user_status'] =
      action === 'FREEZE'
        ? 'Frozen'
        : action === 'LEGAL_BLOCK'
          ? 'Blocked'
          : action === 'RESTORE'
            ? 'Active'
            : target.user_status;
    const nextPenalty =
      action === 'PENALTY' ? target.penalty_score + penaltyPoints : action === 'RESTORE' ? 0 : target.penalty_score;

    setLocalProfiles((prev) =>
      prev.map((p) =>
        p.id === targetProfileId
          ? { ...p, user_status: nextStatus, penalty_score: nextPenalty, block_reason: reason }
          : p
      )
    );
    if (isLiveFirestore && firebaseUser && isAdmin && !SEED_IDS.profiles.has(targetProfileId)) {
      try {
        await updateDoc(doc(db, 'profiles', target.uid), {
          user_status: nextStatus,
          penalty_score: nextPenalty,
          updatedAt: serverTimestamp(),
        });
        await setDoc(
          doc(db, 'profiles_private', target.uid),
          {
            block_reason: reason || '',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `profiles/${targetProfileId}`);
      }
    }
    pushToast('success', `Discipline "${action}" applied to ${target.universal_id}.`);
  };

  const runDailyMicroFeeCycle = async () => {
    if (!requireVerifiedAuth() || !isAdmin) return;
    const fee = systemConfig.daily_micro_fee;
    const eligible = profiles.filter(
      (p) =>
        p.universal_id !== 'UID-1' &&
        p.user_status === 'Active' &&
        (metricsMap[p.universal_id]?.balance ?? 0) > 0
    );
    const collected = Number((eligible.length * fee).toFixed(2));
    setLocalProfiles((prev) =>
      prev.map((p) =>
        eligible.some((e) => e.id === p.id)
          ? { ...p, carried_balance: Number((p.carried_balance - fee).toFixed(2)) }
          : p
      )
    );
    if (isLiveFirestore && firebaseUser && isAdmin) {
      for (const p of eligible) {
        if (!SEED_IDS.profiles.has(p.id)) {
          try {
            await updateDoc(doc(db, 'profiles', p.uid), {
              carried_balance: Number((p.carried_balance - fee).toFixed(2)),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `profiles/${p.uid}`);
          }
        }
      }
    }
    await updateSystemConfig({
      total_micro_fees_collected: Number((systemConfig.total_micro_fees_collected + collected).toFixed(2)),
    });
    pushToast(
      'success',
      `Micro-fee cycle executed: ${collected} pts collected across ${eligible.length} active positive balances.`
    );
  };

  const approveCharityGrant: AliradaContextValue['approveCharityGrant'] = async (
    targetProfileId,
    grantType,
    amountPoints
  ) => {
    if (!requireVerifiedAuth() || !isAdmin) return;
    const target = profiles.find((p) => p.id === targetProfileId);
    if (!target) return;
    const nextCarried = Number((target.carried_balance + amountPoints).toFixed(2));
    const grantConfig = {
      enabled: true,
      grant_type: grantType,
      amount_points: amountPoints,
      last_disbursed_at: new Date().toISOString(),
    };
    setLocalProfiles((prev) =>
      prev.map((p) =>
        p.id === targetProfileId
          ? {
              ...p,
              evidence_approved: true,
              carried_balance: nextCarried,
              charity_grant_config: grantConfig,
            }
          : p
      )
    );
    if (isLiveFirestore && firebaseUser && isAdmin && !SEED_IDS.profiles.has(targetProfileId)) {
      try {
        const profRef = doc(db, 'profiles', target.uid);
        const profSnap = await getDoc(profRef);
        if (profSnap.exists()) {
          await updateDoc(profRef, {
            carried_balance: nextCarried,
            updatedAt: serverTimestamp(),
          });
          await setDoc(
            doc(db, 'profiles_private', target.uid),
            {
              evidence_approved: true,
              charity_grant_config: grantConfig,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `profiles/${targetProfileId}`);
      }
    }
    pushToast('success', `${grantType} charity grant (+${amountPoints} pts) approved & disbursed.`);
  };

  const archiveCurrentCycle = async (nextCycleName: string) => {
    if (!requireVerifiedAuth() || !isAdmin) return;
    const nowIso = new Date().toISOString();
    const rolledProfiles = profiles.map((p) => ({
      uid: p.uid,
      id: p.id,
      nextCarried: metricsMap[p.universal_id]?.balance ?? p.carried_balance,
    }));
    setLocalProfiles((prev) =>
      prev.map((p) => ({
        ...p,
        carried_balance: metricsMap[p.universal_id]?.balance ?? p.carried_balance,
      }))
    );
    if (isLiveFirestore && firebaseUser && isAdmin) {
      for (const item of rolledProfiles) {
        if (!SEED_IDS.profiles.has(item.id)) {
          try {
            await updateDoc(doc(db, 'profiles', item.uid), {
              carried_balance: item.nextCarried,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `profiles/${item.uid}`);
          }
        }
      }
    }
    await updateSystemConfig({
      current_cycle_name: nextCycleName.trim() || 'Cycle 2027-Q1',
      last_cycle_archived_at: nowIso,
    });
    pushToast('success', `Cycle archived. Rolled forward to "${nextCycleName}".`);
  };

  const grantAdminDelegation: AliradaContextValue['grantAdminDelegation'] = async (
    delegateEmail,
    delegateUid,
    tasks
  ) => {
    if (!requireVerifiedAuth() || !isRootAdmin || !firebaseUser) {
      pushToast('error', `Only root administrator (${ROOT_ADMIN_EMAIL}) can delegate admin tasks.`);
      return false;
    }
    const cleanEmail = delegateEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      pushToast('error', 'Please enter a valid delegate email address.');
      return false;
    }
    if (cleanEmail === ROOT_ADMIN_EMAIL) {
      pushToast('warning', 'Root administrator already holds full permissions.');
      return false;
    }
    const cleanTasks = tasks.map((t) => t.trim()).filter(Boolean);
    if (cleanTasks.length === 0) {
      pushToast('error', 'Select at least one admin task to delegate.');
      return false;
    }
    const matchedProfile = profiles.find(
      (p) => (p.email || '').toLowerCase() === cleanEmail || (delegateUid && p.universal_id === delegateUid.trim().toUpperCase())
    );
    const cleanUid = (delegateUid.trim() || matchedProfile?.universal_id || '').toUpperCase();
    const existing = adminDelegates.find((d) => d.delegate_email.toLowerCase() === cleanEmail);
    const id = existing?.id || makeId('adm_del');

    try {
      await setDoc(
        doc(db, 'admin_delegates', id),
        {
          delegate_email: cleanEmail,
          delegate_uid: cleanUid,
          tasks: cleanTasks,
          delegated_by: ROOT_ADMIN_EMAIL,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (matchedProfile && !SEED_IDS.profiles.has(matchedProfile.id)) {
        await setDoc(
          doc(db, 'admins', matchedProfile.uid),
          {
            uid: matchedProfile.uid,
            email: cleanEmail,
            invite_id: id,
            granted_by: ROOT_ADMIN_EMAIL,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      pushToast('success', `Delegated ${cleanTasks.length} admin task(s) to ${cleanEmail}.`);
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admin_delegates/${id}`);
      return false;
    }
  };

  const revokeAdminDelegation: AliradaContextValue['revokeAdminDelegation'] = async (delegateId) => {
    if (!requireVerifiedAuth() || !isRootAdmin || !firebaseUser) {
      pushToast('error', `Only root administrator (${ROOT_ADMIN_EMAIL}) can revoke delegations.`);
      return false;
    }
    const targetDelegate = adminDelegates.find((d) => d.id === delegateId);
    try {
      await deleteDoc(doc(db, 'admin_delegates', delegateId));
      if (targetDelegate) {
        const matchedProfile = profiles.find(
          (p) => (p.email || '').toLowerCase() === targetDelegate.delegate_email.toLowerCase()
        );
        if (matchedProfile && !SEED_IDS.profiles.has(matchedProfile.id)) {
          try {
            await deleteDoc(doc(db, 'admins', matchedProfile.uid));
          } catch {
            // non-fatal if doc didn't exist yet
          }
        }
      }
      pushToast('success', 'Admin task delegation revoked.');
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `admin_delegates/${delegateId}`);
      return false;
    }
  };

  const deleteMockData: AliradaContextValue['deleteMockData'] = async () => {
    if (!requireVerifiedAuth() || !isAdmin) return false;
    setLocalProfiles((prev) => prev.filter((x) => !SEED_IDS.profiles.has(x.id)));
    setLocalServiceLogs((prev) => prev.filter((x) => !SEED_IDS.serviceLogs.has(x.id)));
    setLocalDeductionLogs((prev) => prev.filter((x) => !SEED_IDS.deductions.has(x.id)));
    setLocalVotes((prev) => prev.filter((x) => !SEED_IDS.votes.has(x.id)));
    setLocalListings((prev) => prev.filter((x) => !SEED_IDS.listings.has(x.id)));
    setLocalProjects((prev) => prev.filter((x) => !SEED_IDS.projects.has(x.id)));
    setLocalHierarchy((prev) => prev.filter((x) => !SEED_IDS.hierarchy.has(x.id)));
    setLocalEmployment((prev) => prev.filter((x) => !SEED_IDS.jobs.has(x.id)));
    setLocalOrders((prev) => prev.filter((x) => !SEED_IDS.orders.has(x.id)));
    setLocalInvestments((prev) => prev.filter((x) => !SEED_IDS.investments.has(x.id)));
    setLocalProjectReports((prev) => prev.filter((x) => !SEED_IDS.projectReports.has(x.id)));
    setLocalExchanges((prev) => prev.filter((x) => !SEED_IDS.exchanges.has(x.id)));
    setLocalRefs((prev) => prev.filter((x) => !SEED_IDS.refs.has(x.id)));
    setLocalBatches((prev) => prev.filter((x) => !SEED_IDS.batches.has(x.id)));
    setLocalGov((prev) => prev.filter((x) => !SEED_IDS.gov.has(x.id)));
    setLocalNotifications((prev) => prev.filter((x) => !SEED_IDS.notifs.has(x.id)));

    try {
      localStorage.setItem('alirada_mock_cleared', 'true');
      localStorage.removeItem('alirada_activated_seed_listings');
    } catch {
      // ignore storage errors
    }

    const nextMicroTotal =
      !mockDataCleared && systemConfig.total_micro_fees_collected === DEFAULT_SYSTEM_CONFIG.total_micro_fees_collected
        ? 0
        : systemConfig.total_micro_fees_collected;

    await updateSystemConfig({
      mock_data_cleared: true,
      total_micro_fees_collected: nextMicroTotal,
    });
    pushToast('success', 'All demo/mock seed records permanently cleared from the platform.');
    return true;
  };

  const markNotificationRead = async (id: string) => {
    setLocalNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (isLiveFirestore && firebaseUser && !SEED_IDS.notifs.has(id)) {
      try {
        await updateDoc(doc(db, 'notifications', id), { read: true });
      } catch {
        // ignore if notification does not exist in Firestore
      }
    }
  };

  return (
    <AliradaContext.Provider
      value={{
        firebaseUser,
        authReady,
        isFirebaseConfigured,
        isLiveFirestore,
        isRootAdmin,
        isAdmin,
        adminDelegates,
        myDelegatedTasks,
        mockDataCleared,
        mockRecordCount,
        currentProfile,
        profiles,
        metricsMap,
        serviceLogs,
        deductionLogs,
        recognitionVotes,
        listings,
        projects,
        hierarchyItems,
        employmentPostings,
        orders,
        deliveries,
        investments,
        projectReports,
        pointExchanges,
        transactionRefs,
        batchPayments,
        governanceDelegates,
        userReports,
        notifications,
        systemConfig,
        activeSection,
        setActiveSection,
        theme,
        toggleTheme,
        inspectedUid,
        setInspectedUid,
        authModalOpen,
        setAuthModalOpen,
        reportModalTarget,
        setReportModalTarget,
        activeCheckoutRefCode,
        setActiveCheckoutRefCode,
        toasts,
        pushToast,
        dismissToast,
        pendingPayRef,
        clearPendingPayRef,
        signInWithGoogle,
        signInEmail,
        registerEmail,
        recoverViaSecurityQuestion,
        signOutUser,
        updateOwnProfile,
        saveLegacyProtocol,
        logService,
        logRequestedServant,
        castRecognitionVote,
        replyToRecognition,
        createListing,
        updateListing,
        deactivateListing,
        deleteListing,
        activateListingForOrders,
        placeOrder,
        confirmOrderDelivery,
        investInProject,
        updateProjectInvestmentConfig,
        submitProjectInvestmentReport,
        createProject,
        joinOrRequestProject,
        approveProjectMember,
        addHierarchyItem,
        voteHierarchyItem,
        assignHierarchyUids,
        submitExecutionReport,
        createJobPosting,
        applyToJob,
        inviteToJob,
        updateJobApplicantStatus,
        issueTransactionRef,
        redeemTransactionRef,
        deactivateTransactionRef,
        deleteTransactionRef,
        saveBatchPayment,
        sendBatchPayment,
        deleteBatchPayment,
        createPointExchange,
        submitExchangeProof,
        releasePointExchange,
        deactivatePointExchange,
        cancelPointExchange,
        saveGovernanceDelegate,
        voteForCeo,
        submitUserReport,
        resolveUserReport,
        updateSystemConfig,
        applyAdminDiscipline,
        runDailyMicroFeeCycle,
        approveCharityGrant,
        archiveCurrentCycle,
        grantAdminDelegation,
        revokeAdminDelegation,
        deleteMockData,
        markNotificationRead,
      }}
    >
      {children}
    </AliradaContext.Provider>
  );
};

export function useAlirada(): AliradaContextValue {
  const ctx = useContext(AliradaContext);
  if (!ctx) {
    throw new Error('useAlirada must be used within AliradaProvider');
  }
  return ctx;
}
