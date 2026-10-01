/**
 * Canonical Reach International Database Seed Script
 * Delegates to the comprehensive frontend workflow seed script:
 * - Purges old dummy/legacy data
 * - Registers users following frontend Signup acceptance criteria with unmasked bank, Aadhaar, DL
 * - Simulates user document upload & Admin approval workflow
 * - Creates clients via Add Client Page acceptance criteria (valid GSTIN, PAN, allowance)
 * - Provisions machinery fleet and active operator assignments
 * - Submits machine hour logs via atomic log submission pipeline with sequential meters & breakdown tracking
 */
import './seed_frontend_workflow.mjs';