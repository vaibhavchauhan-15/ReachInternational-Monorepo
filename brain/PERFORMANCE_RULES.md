# Enterprise Performance Rules — ServiceCentric

1. **Explicit Projections Only**: Never use `SELECT *` for list pages or table directories. Project only required UI columns.
2. **Mandatory Server Pagination**: Never load an entire large table into the browser. Always paginate with 20–50 items per page.
3. **Cursor/Keyset Pagination**: Prefer cursor/keyset pagination (`created_at`, `id`) over deep offset pagination for large operational tables.
4. **Foreign Key & RLS Indexing**: Always index foreign keys, `branch_id`, `organization_id`, and columns referenced by RLS policies.
5. **Composite Indexing**: Use composite indexes (`branch_id + status + created_at DESC`) for common filter and sort patterns.
6. **Data Freshness Classification**: Classify all data into Class A (Static 24h), Class B (Semi-Dynamic 1–5m), Class C (Operational 0–15s), and Class D (Realtime 0s).
7. **No Over-Caching Operational Data**: Do not cache critical operational state (current stock balance, breakdown status, PO approvals, running hours) for long periods.
8. **Tag-Based Invalidation**: Use precise tag-based invalidation (`revalidateTag(TAGS.machines)`) in Server Actions immediately after data mutations.
9. **Scope-Aware Cache Keys**: Never cache across users without incorporating authorization scope (`branch_id`, `user_id`, `role`) into the cache key array.
10. **Data Privacy First**: Keep sensitive user, HR, and financial data strictly private; authorization rules take precedence over caching.
11. **Supabase Storage CDN**: Serve all machine photos, PDFs, and uploaded documents directly through Supabase Storage CDN with cache-control headers.
12. **Image Transformation**: Resize images to required display sizes (thumbnails 320px, detail 800px) using Supabase Storage image transformations.
13. **Background Export Jobs**: Generate large Excel exports and bulk PDF reports asynchronously using QStash background jobs rather than blocking synchronous requests.
14. **Server Components by Default**: Build pages using React Server Components (RSC) by default. Use Client Components (`"use client"`) only for interactive elements.
15. **Selective Component Boundaries**: Isolate interactive forms, modals, filter bars, and charts into standalone Client Components.
16. **Lazy-Load Heavy Libraries**: Dynamically import heavy libraries (e.g. `Recharts`, PDF generators) with `next/dynamic` so non-analytical roles don't download unused JavaScript.
17. **Selective Realtime**: Subscribe only critical breakdown alerts, user notifications, and active task counters to Supabase Realtime channels.
18. **Lightweight Daily Workspace (`/my-work`)**: Keep `/my-work` extremely fast by fetching only user-assigned actionable items (`LIMIT 20`).
19. **Parallel Async Data Queries**: Avoid sequential `await` waterfalls; execute independent queries in parallel using `Promise.all()`.
20. **Database Aggregation Views**: Use database summary views (`v_branch_dashboard_summary`) or RPC functions to aggregate complex metrics in Postgres.
21. **Asynchronous Notification Delivery**: Dispatch email, WhatsApp, and SMS notifications via background workers (`lib/notifications/`) so user mutation responses return instantly.
22. **Skeleton Screen Indicators**: Use smooth UI `<Skeleton />` loaders instead of blocking page spinners to minimize perceived latency.
23. **Weak-Network Field Resilience**: Support offline/local storage draft buffering for field engineers and operators in low-connectivity areas.
24. **Continuous Query Auditing**: Regularly inspect slow queries, RLS evaluation times, and cache hit/miss metrics using Supabase Query Performance tools.
25. **Measure Before Optimizing**: Verify all performance changes with concrete timing data before committing code.
