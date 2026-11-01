-- ==============================================================================
-- Seed: Request-a-Quote (RFQ) Reference Data
-- File: supabase/seed.rfq.sql
--
-- Contents:
-- 1. All 36 Indian States and Union Territories with official GST state codes.
-- 2. Single-row Reach International business profile for quotations and notifications.
-- ==============================================================================

-- 1. All 36 Indian States & Union Territories with official GST state codes
INSERT INTO public.states (id, name, code, gst_state_code) VALUES
  (1, 'Jammu and Kashmir', 'JK', '01'),
  (2, 'Himachal Pradesh', 'HP', '02'),
  (3, 'Punjab', 'PB', '03'),
  (4, 'Chandigarh', 'CH', '04'),
  (5, 'Uttarakhand', 'UK', '05'),
  (6, 'Haryana', 'HR', '06'),
  (7, 'Delhi', 'DL', '07'),
  (8, 'Rajasthan', 'RJ', '08'),
  (9, 'Uttar Pradesh', 'UP', '09'),
  (10, 'Bihar', 'BR', '10'),
  (11, 'Sikkim', 'SK', '11'),
  (12, 'Arunachal Pradesh', 'AR', '12'),
  (13, 'Nagaland', 'NL', '13'),
  (14, 'Manipur', 'MN', '14'),
  (15, 'Mizoram', 'MZ', '15'),
  (16, 'Tripura', 'TR', '16'),
  (17, 'Meghalaya', 'ML', '17'),
  (18, 'Assam', 'AS', '18'),
  (19, 'West Bengal', 'WB', '19'),
  (20, 'Jharkhand', 'JH', '20'),
  (21, 'Odisha', 'OR', '21'),
  (22, 'Chhattisgarh', 'CT', '22'),
  (23, 'Madhya Pradesh', 'MP', '23'),
  (24, 'Gujarat', 'GJ', '24'),
  (27, 'Maharashtra', 'MH', '27'),
  (28, 'Andhra Pradesh', 'AP', '28'),
  (29, 'Karnataka', 'KA', '29'),
  (30, 'Goa', 'GA', '30'),
  (31, 'Lakshadweep', 'LD', '31'),
  (32, 'Kerala', 'KL', '32'),
  (33, 'Tamil Nadu', 'TN', '33'),
  (34, 'Puducherry', 'PY', '34'),
  (35, 'Andaman and Nicobar Islands', 'AN', '35'),
  (36, 'Telangana', 'TG', '36'),
  (37, 'Ladakh', 'LA', '37'),
  (38, 'Dadra and Nagar Haveli and Daman and Diu', 'DH', '38')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  gst_state_code = EXCLUDED.gst_state_code;

-- 2. Reach International Business Profile (Single row id = true)
INSERT INTO public.business_profile (
  id,
  legal_name,
  gstin,
  address,
  state_code,
  phone,
  email,
  bank_details,
  default_terms_md,
  default_validity_days,
  default_gst_rate,
  rfq_notify_emails
) VALUES (
  true,
  'Reach International Machinery Pvt. Ltd.',
  '07AABCR1234F1Z5',
  'Plot No. 42, Industrial Area, Phase II, New Delhi - 110020, India',
  'DL',
  '+91 98765 43210',
  'sales@reachinternational.co.in',
  E'Bank: HDFC Bank Ltd.\nAccount Name: Reach International Machinery Pvt. Ltd.\nAccount No: 50200012345678\nIFSC Code: HDFC0001234\nBranch: Okhla Phase II, New Delhi',
  E'### Standard Quotation Terms & Conditions\n\n1. **Taxation**: All rates quoted are exclusive of Goods and Services Tax (GST). Applicable GST (CGST+SGST or IGST) will be charged extra as per statutory rates.\n2. **Mobilization & Demobilization**: Transport and freight charges to and from site are payable by the client unless explicitly specified as included.\n3. **Site & Fuel Responsibilities**: High-Speed Diesel (HSD) for diesel-powered machinery, charging power supply for electric units, competent on-site security, and operator accommodation/transport are in client scope.\n4. **Payment Terms**: 100% advance for monthly rental charges along with one month security deposit prior to machinery dispatch.\n5. **Validity**: This quotation is valid for 15 days from the issue date and is subject to fleet availability at the time of confirmed purchase order issuance.',
  15,
  18.00,
  ARRAY['sales@reachinternational.co.in', 'quotes@reachinternational.co.in']
)
ON CONFLICT (id) DO UPDATE SET
  legal_name = EXCLUDED.legal_name,
  gstin = EXCLUDED.gstin,
  address = EXCLUDED.address,
  state_code = EXCLUDED.state_code,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  bank_details = EXCLUDED.bank_details,
  default_terms_md = EXCLUDED.default_terms_md,
  default_validity_days = EXCLUDED.default_validity_days,
  default_gst_rate = EXCLUDED.default_gst_rate,
  rfq_notify_emails = EXCLUDED.rfq_notify_emails,
  updated_at = now();
