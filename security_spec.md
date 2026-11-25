# Alirada Security Specification (Payload-First TDD)

## 1. Data Invariants
1. **Identity & Email-to-UID Binding**: A `profiles/{uid}` document can only be created for `request.auth.uid` with verified email (`request.auth.token.email_verified == true`), and users cannot escalate `user_status`, `penalty_score`, or `carried_balance` on their own profile.
2. **PII Isolation**: Sensitive fields (`email`, `contact_info`, `security_question`, `security_answer_hash`, `successor_email`, `legacy_beneficiaries`) live exclusively in `profiles_private/{uid}`, readable and writable only by the profile owner or an admin.
3. **Self-Service & Self-Vote Guardrails**: A user cannot log service where `provider_uid == recipient_uid`, cannot cast a `recognition_votes` record targeting their own `universal_id`, cannot order their own listing, and cannot redeem their own issued `transaction_refs` code.
4. **Daily Hours Cap**: `service_logs.hours` must be `> 0` and `<= 10`, and `hardship` must be an integer `1..10`, with `final_score == hours * hardship`.
5. **Obligation Lock**: Records with `obligation_status == 'HasObligations'` cannot be edited or deleted by non-admins.
6. **Terminal State Locking**: Once an `Order` reaches `Completed` or `Rejected`, a `TransactionRef` reaches `Confirmed` or `Cancelled`, or a `PointExchange` reaches `Released` or `Cancelled`, non-admins cannot mutate it.
7. **Transaction Reference Privacy**: `transaction_refs` list queries are restricted to `issuer_auth_uid`, `counterparty_auth_uid`, or `isAdmin()`.
8. **Admin Exclusivity**: Only verified admins (`amrelyon@gmail.com` or `admins/{uid}`) can modify `system_config`, approve `evidence_approved`, or apply discipline (`penalty_score`, `user_status`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Profile**: `{ uid: "u1", universal_id: "UID-99", full_name: "Mallory", ..., isAdmin: true }` -> Rejected by `keys().hasOnly(...)`.
2. **Self-Penalty Tampering**: Authenticated user updates `profiles/{uid}` changing `penalty_score: -500` or `user_status: "Active"` from `"Blocked"` -> Rejected by update action `affectedKeys().hasOnly(...)`.
3. **PII Cross-Read**: User A attempts `get` on `profiles_private/userB` -> Rejected by `request.auth.uid == uid || isAdmin()`.
4. **Unverified Email Write**: Token with `email_verified: false` attempts to write `service_logs` -> Rejected by `isVerifiedSignedIn()`.
5. **Self-Service Farming**: `service_logs` payload with `provider_uid: "UID-2", recipient_uid: "UID-2"` -> Rejected by `incoming().provider_uid != incoming().recipient_uid`.
6. **Self-Recognition Manipulation**: `recognition_votes` payload with `target_uid: "UID-2", recognizer_uid: "UID-2"` -> Rejected by `incoming().target_uid != incoming().recognizer_uid`.
7. **Over-Cap Service Hours**: `service_logs` payload with `hours: 25, hardship: 10` -> Rejected by `incoming().hours > 0 && incoming().hours <= 10`.
8. **Fake Score Injection**: `service_logs` payload with `hours: 2, hardship: 3, final_score: 500` -> Rejected by `incoming().final_score == incoming().hours * incoming().hardship`.
9. **Resource Poisoning ID**: `listings/{1500_char_id}` -> Rejected by `isValidId(listingId)`.
10. **Obligation Bypass Delete**: Seller deletes `listings/{id}` where `obligation_status == 'HasObligations'` -> Rejected by `existing().obligation_status == 'None' || isAdmin()`.
11. **Terminal Order Reversal**: Buyer updates `orders/{id}` from `Completed` back to `Pending` -> Rejected by terminal lock.
12. **Blanket Transaction Ref Scraping**: User C runs `list` on `transaction_refs` without filtering to own `issuer_auth_uid`/`counterparty_auth_uid` -> Rejected by `allow list` resource check.
