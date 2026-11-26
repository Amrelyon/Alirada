export type EntityType =
  | 'Individual'
  | 'Family'
  | 'Organization'
  | 'Governmental'
  | 'Charity / Vulnerable Entity';

export type UserStatus = 'Active' | 'Warning' | 'Frozen' | 'Blocked';
export type ImageVerifiedStatus = 'Pending' | 'Verified' | 'Flagged';
export type ObligationStatus = 'None' | 'HasObligations';
export type PaymentModel = 'One-Time' | 'Monthly Installment' | 'Monthly Subscription';

export interface LegacyBeneficiary {
  uid: string;
  email: string;
  percentage: number;
}

export interface CharityGrantConfig {
  enabled: boolean;
  grant_type: 'One-Time' | 'Monthly';
  amount_points: number;
  last_disbursed_at?: string;
}

export interface AliradaProfile {
  id: string; // auth uid
  uid: string; // auth uid
  universal_id: string; // UID-1, UID-2, etc.
  full_name: string;
  entity_type: EntityType;
  country: string;
  city: string;
  profile_image_url: string;
  image_verified_status: ImageVerifiedStatus;
  user_status: UserStatus;
  penalty_score: number;
  carried_balance: number;
  absent_period_days: number;
  last_active_at?: string;
  created_at: string;
  // Private fields (hydrated only for owner or admin from profiles_private)
  email?: string;
  contact_info?: string;
  registration_evidence?: string;
  evidence_approved?: boolean;
  security_question?: string;
  security_answer_hash?: string;
  block_reason?: string;
  freeze_until?: string;
  successor_email?: string;
  legacy_beneficiaries?: LegacyBeneficiary[];
  charity_grant_config?: CharityGrantConfig;
}

export interface ServiceLog {
  id: string;
  log_number: string;
  logged_date: string;
  provider_uid: string;
  provider_auth_uid: string;
  recipient_uid: string;
  service_type: string;
  hours: number;
  hardship: number;
  final_score: number;
  evidence_link?: string;
  google_map_link?: string;
  notes?: string;
  project_context?: string;
  entity_type?: EntityType;
  created_by_delegate_id?: string;
  daily_exceed_flag: boolean;
  created_at: string;
}

export interface RequestedServantLog {
  id: string;
  request_number: string;
  logged_date: string;
  requested_servant_uid: string;
  requester_uid: string;
  requester_auth_uid: string;
  related_service_log_id?: string;
  deducted_score: number;
  evidence_link?: string;
  notes?: string;
  entity_type?: EntityType;
  created_by_delegate_id?: string;
  status: 'Recorded' | 'Disputed' | 'Resolved';
  created_at: string;
}

export interface RecognitionVote {
  id: string;
  target_uid: string;
  recognizer_uid: string;
  recognizer_auth_uid: string;
  direction: 'UPWARD' | 'COMPENSATE';
  comment: string;
  reply?: string;
  replied_at?: string;
  created_at: string;
}

export interface Listing {
  id: string;
  listing_code: string;
  owner_uid: string;
  owner_auth_uid: string;
  listing_type: 'Product' | 'Service' | 'Course';
  title: string;
  category: string;
  description: string;
  delivery_method?: string;
  location?: string;
  google_map_link?: string;
  contact_info?: string;
  image_urls: string[];
  video_url?: string;
  evidence_link?: string;
  price_points: number;
  payment_model: PaymentModel;
  end_date?: string;
  linked_project_id?: string;
  investment_goal_points?: number;
  budget_doc_url?: string;
  presentation_url?: string;
  entity_type?: EntityType;
  availability_status?: 'Funding' | 'Active' | 'Deactivated';
  is_deactivated?: boolean;
  obligation_status: ObligationStatus;
  created_at: string;
}

export interface Project {
  id: string;
  project_code: string;
  owner_uid: string;
  owner_auth_uid: string;
  elected_ceo_uid?: string;
  name: string;
  category: string;
  description: string;
  visibility: 'Public' | 'Private';
  location?: string;
  google_map_link?: string;
  contact_info?: string;
  image_urls: string[];
  video_url?: string;
  evidence_link?: string;
  entity_type?: EntityType;
  investment_goal_points?: number;
  budget_doc_url?: string;
  presentation_url?: string;
  investment_status?: 'Open' | 'Deactivated' | 'Closed';
  delegates: { uid: string; email: string; role: string }[];
  members: string[];
  join_requests: string[];
  obligation_status: ObligationStatus;
  created_at: string;
}

export interface ProjectInvestmentReportLink {
  label: string;
  url: string;
}

export interface ProjectInvestmentReport {
  id: string;
  report_code: string;
  project_id: string;
  project_code: string;
  author_uid: string;
  author_auth_uid: string;
  title: string;
  summary_text: string;
  links: ProjectInvestmentReportLink[];
  period_cost_points: number;
  period_income_points: number;
  total_accumulated_cost: number;
  total_accumulated_income: number;
  created_at: string;
}

export interface ExecutionReport {
  id: string;
  worker_uid: string;
  hours_spent: number;
  hardship_rating: number;
  summary: string;
  logged_at: string;
}

export interface ProjectHierarchyItem {
  id: string;
  task_code: string;
  project_id: string;
  creator_auth_uid: string;
  function_name: string;
  step_title?: string;
  fix_title?: string;
  description?: string;
  video_url?: string;
  image_url?: string;
  doc_url?: string;
  resource_links: string[];
  estimated_cost?: number;
  votes: Record<string, 'Agree' | 'Disagree'>;
  approval_status: 'Pending' | 'Approved' | 'Rejected';
  assigned_uids: string[];
  hours_spent?: number;
  hardship_rating?: number;
  execution_status: 'Open' | 'In Progress' | 'Executed';
  execution_reports: ExecutionReport[];
  obligation_status: ObligationStatus;
  created_at: string;
}

export interface JobApplicant {
  uid: string;
  full_name: string;
  contact_number: string;
  cv_link: string;
  applied_at: string;
  status: 'Applied' | 'Shortlisted' | 'Accepted' | 'Declined';
}

export interface JobInvite {
  uid: string;
  invited_at: string;
  status: 'Invited' | 'Accepted' | 'Declined';
}

export interface EmploymentPosting {
  id: string;
  job_code: string;
  project_id: string;
  poster_uid: string;
  poster_auth_uid: string;
  position_title: string;
  qualifications?: string;
  tasks_summary?: string;
  required_course_ids: string[];
  location?: string;
  status: 'Open' | 'Filled' | 'Closed';
  applicants: JobApplicant[];
  invites: JobInvite[];
  obligation_status: ObligationStatus;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  order_date: string;
  buyer_uid: string;
  buyer_auth_uid: string;
  seller_uid: string;
  seller_auth_uid: string;
  listing_id: string;
  listing_code: string;
  listing_type: 'Product' | 'Service' | 'Course';
  quantity: number;
  total_points: number;
  payment_model: PaymentModel;
  end_date?: string;
  google_map_link?: string;
  notes?: string;
  order_status: 'Pending' | 'Confirmed' | 'Completed' | 'Rejected';
  delivery_status: 'Awaiting' | 'Delivered' | 'Partially Delivered' | 'Rejected';
  rejection_reason?: string;
  c2p_ref_code?: string;
  c2p_payment_link?: string;
  trigger_type?: string;
  trigger_payload?: string;
  obligation_status: ObligationStatus;
  created_at: string;
}

export interface Delivery {
  id: string;
  delivery_number: string;
  order_id: string;
  receiver_uid: string;
  receiver_auth_uid: string;
  seller_auth_uid: string;
  delivery_evidence?: string;
  delivery_status: 'Delivered' | 'Partially Delivered' | 'Rejected';
  notes?: string;
  rejection_reason?: string;
  created_by_delegate_id?: string;
  obligation_status: ObligationStatus;
  created_at: string;
}

export interface Investment {
  id: string;
  investment_code: string;
  investor_uid: string;
  investor_auth_uid: string;
  project_id?: string;
  project_code?: string;
  listing_id: string;
  listing_code: string;
  target_type: string;
  invested_points: number;
  share_percentage: number;
  budget_doc_link?: string;
  presentation_link?: string;
  dividends_earned: number;
  status: 'Active' | 'Returned' | 'Cancelled';
  obligation_status: ObligationStatus;
  created_at: string;
}

export interface PointExchange {
  id: string;
  exchange_code: string;
  buyer_uid?: string;
  buyer_auth_uid?: string;
  seller_uid: string;
  seller_auth_uid: string;
  points_requested: number;
  cash_amount: number;
  currency: string;
  status: 'Open' | 'Escrow Locked' | 'Proof Submitted' | 'Released' | 'Deactivated' | 'Cancelled';
  is_deactivated?: boolean;
  payment_proof?: string;
  notes?: string;
  obligation_status: ObligationStatus;
  created_at: string;
}

export type TriggerType =
  | 'None'
  | 'Redirect URL'
  | 'Webhook/Notification'
  | 'Access Grant'
  | 'Order Creation'
  | 'Manual Verification Request';

export interface C2PSettlementRecord {
  payer_uid: string;
  payer_auth_uid: string;
  payer_email?: string;
  points_amount: number;
  order_id?: string;
  order_number?: string;
  paid_at: string;
}

export interface TransactionRef {
  id: string;
  ref_code: string;
  ref_type: 'P2P' | 'C2P';
  issuer_uid: string;
  issuer_auth_uid: string;
  counterparty_uid?: string;
  counterparty_auth_uid?: string;
  participant_auth_uids?: string[];
  linked_listing_code?: string;
  linked_order_id?: string;
  widget_name?: string;
  points_amount: number;
  payment_model: PaymentModel;
  end_date?: string;
  description?: string;
  trigger_type: TriggerType;
  trigger_payload?: string;
  status: 'Open' | 'Pending' | 'Confirmed' | 'Deactivated' | 'Cancelled';
  is_deactivated?: boolean;
  payments_count?: number;
  last_paid_by_uid?: string;
  c2p_settlements?: C2PSettlementRecord[];
  payer_email?: string;
  confirmed_at?: string;
  obligation_status: ObligationStatus;
  created_at: string;
}

export interface BatchRecipient {
  uid: string;
  points: number;
  note?: string;
}

export interface BatchPayment {
  id: string;
  batch_code: string;
  creator_uid: string;
  creator_auth_uid: string;
  batch_name: string;
  recipients: BatchRecipient[];
  scheduled_time?: string;
  recurrence: 'Once' | 'Weekly' | 'Monthly';
  notes?: string;
  last_sent_at?: string;
  send_count: number;
  status: 'Draft' | 'Scheduled' | 'Sent';
  obligation_status: ObligationStatus;
  created_at: string;
}

export interface GovernanceDelegate {
  id: string;
  scope: 'INSTITUTIONAL' | 'PLATFORM';
  principal_uid: string;
  principal_auth_uid: string;
  entity_name: string;
  delegate_email: string;
  delegate_uid?: string;
  delegated_tasks: string[];
  ceo_votes: string[]; // array of voter_uid -> voted_delegate_uid formatted as "voter_uid:candidate_uid"
  successor_email?: string;
  absent_period_days: number;
  updated_at: string;
}

export interface UserReport {
  id: string;
  report_code: string;
  reporter_uid?: string;
  reporter_auth_uid: string;
  reporter_email: string;
  reported_uid?: string;
  target_type: 'User' | 'Profile Image' | 'Service Log' | 'Listing' | 'Order' | 'Recognition Fraud';
  target_id: string;
  target_snapshot?: string;
  reason: string;
  admin_comment?: string;
  admin_action_taken?: string;
  status: 'Open' | 'Reviewed' | 'Actioned' | 'Dismissed';
  created_at: string;
}

export interface PlatformNotification {
  id: string;
  actor_uid: string;
  target_uid: string;
  target_auth_uid: string;
  title: string;
  message: string;
  is_admin_alert: boolean;
  read: boolean;
  created_at: string;
}

export interface AdminDelegate {
  id: string;
  delegate_email: string;
  delegate_uid?: string;
  tasks: string[];
  delegated_by: string;
  active: boolean;
  created_at: string;
}

export interface SystemConfigState {
  negative_points_floor: number;
  daily_warn_hours: number;
  daily_max_hours: number;
  daily_micro_fee: number;
  total_micro_fees_collected: number;
  intro_video_url: string;
  custom_categories: string[];
  custom_services: string[];
  current_cycle_name: string;
  last_cycle_archived_at?: string;
  mock_data_cleared?: boolean;
}

export interface LedgerMetrics {
  universal_id: string;
  services_given: number;
  hours_served: number;
  score_earned: number;
  credits_in: number;
  total_earned: number;
  services_received: number;
  deductions: number;
  penalty_score: number;
  total_deductions: number;
  carried_balance: number;
  raw_balance: number;
  balance: number;
  average_hardship: number;
  service_tier: string;
  upward_votes: number;
  compensate_votes: number;
  today_hours: number;
  earning_breakdown: {
    services: number;
    orders_sold: number;
    dividends: number;
    c2p_p2p_in: number;
    batch_in: number;
    exchange_in: number;
  };
  deduction_breakdown: {
    requested_servants: number;
    orders_spent: number;
    investments_out: number;
    c2p_p2p_out: number;
    batch_out: number;
    exchange_escrow_out: number;
    penalty: number;
  };
}
