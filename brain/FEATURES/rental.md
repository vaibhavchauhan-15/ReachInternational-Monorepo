# Feature: Rental Management (Role 11 — Rental Manager)

## Overview
The **Rental Manager** owns the complete machine-rental lifecycle: rental customer onboarding, machine availability checks, rental requests, contract/agreement creation, pricing & discount approvals, pre-dispatch inspections, delivery challans, machine returns, return inspections, damage reporting, rental extensions, early returns, service breakdown coordination, and operational billing requests — while Service owns technical repairs, Store owns physical inventory, and Finance owns actual accounting and payments.

## Database Tables & Schema
- `rental_customers`: Company name, contact person, mobile, email, billing address, city, state, gstin, status (`active`, `inactive`, `archived`).
- `rental_requests`: Enquiries, customer, category, machine, start/end dates, location, operator & delivery requirements, status (`pending`, `approved`, `rejected`, `cancelled`, `converted_to_contract`).
- `rental_agreements`: Contracts, rate, unit (`daily`, `weekly`, `monthly`), allowed hours/day, extra hour rate, deposit, delivery charges, discount %, discount approval flag, status (`draft`, `pending_approval`, `approved`, `active`, `extended`, `returned`, `closed`, `cancelled`, `rejected`, `expired`).
- `rental_delivery_challans`: Dispatch date, site location, driver, vehicle details, operator, start hour meter, start fuel %, accessories, condition, status (`draft`, `finalized`, `cancelled`).
- `rental_return_inspections`: Return date, end hour meter, end fuel %, condition breakdown (exterior, tyres, engine, hydraulics, attachments, safety), missing accessories, damage flag & description, estimated repair cost, status (`passed`, `failed_damaged`, `under_inspection`).
- `rental_damage_reports`: Damage details, severity (`minor`, `moderate`, `severe`), service & finance notification status, damage charge amount, status (`reported`, `under_assessment`, `charged`, `resolved`).
- `rental_extension_requests`: Proposed end date, extension days, additional amount, availability status (`available`, `conflict_reserved`), status (`pending`, `approved`, `rejected`).
- `rental_billing_requests`: Base rental, extra hours amount, transport, damage charges, deposit adjustment, total billable, status (`submitted_to_finance`, `invoiced`, `paid`, `rejected`).
- `rental_accessories_log`: Accessory name, quantity, dispatch/return condition, return status.

## Governance & Hard Restrictions Enforced
1. **Machine Creation & Hard Deletion**: Blocked (`createMachine` and `deleteMachine` restrict `rental_manager`).
2. **Master Technical Specifications**: Disabled in `MachineModal.tsx` and filtered out in `updateMachine` action for `rental_manager` (only rental status, notes, and customer address editable).
3. **Discount Approval Threshold**: Discounts $> 15\%$ automatically flag agreement as `pending_approval` requiring higher authorization.
4. **Machine Availability Matrix**: Machine is unbookable if currently rented (`on_rent`), reserved (`reserved`), under maintenance (`under_maintenance`), or on safety hold (`safety_hold`).
5. **Customer Archiving**: Soft archive applied for customers with historical rental agreements.
6. **Damage Routing**: Return inspections with damages auto-create Damage Reports and trigger Service Manager & Finance notifications.

## Key Files & Modules
- `supabase/migrations/027_rental_manager_role_refinements.sql`
- `lib/auth/rbac.ts` & `lib/auth/scope.ts`
- `lib/queries/rentals.ts`
- `app/actions/rentals.ts` & `app/actions/machines.ts`
- `app/(app)/rentals/page.tsx`
- `components/rentals/RentalManagementClient.tsx`
- `components/layout/AppSidebar.tsx`
- `components/machines/MachineModal.tsx` & `MachineListClient.tsx`
