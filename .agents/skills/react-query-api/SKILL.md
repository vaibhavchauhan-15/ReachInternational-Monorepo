---
name: react-query-api
description: Use when TanStack Query or React Query is installed, already used by the feature, or explicitly requested. Covers typed transport boundaries, query keys, mutations, cache behavior, prefetching, hydration, and server-state UI.
---

# React Query API

Repository instructions, the installed TanStack Query version, provider defaults,
API client, and neighboring hooks take precedence. Do not introduce this library
into projects using another server-state approach unless explicitly requested.

## Related Skills

- Use `react-components` for component structure and client boundaries.
- Use `react-hook-form-yup` for form state, validation, and payload conversion.
- Use `nextjs-app-router` for server prefetching, route pages, and hydration boundaries.
- Use `react-tanstack-table` for table column definitions and grid state; keep transport and cache ownership here.
- Use `react-toastify` for user-facing mutation success and failure feedback.
- Use `frontend-testing` for query, mutation, loading, and error behavior tests.

## API Boundary

- Keep HTTP transport in a domain API module, never inline in JSX.
- Use the existing shared connector for base URL, authentication headers, serialization, response parsing, and unauthorized handling.
- Export typed request parameters, payloads, and response contracts at the API boundary.
- Follow the API module's established operation naming; use intention-revealing
  names without encoding HTTP verbs unless that is the local convention.
- Keep endpoint-specific response mapping in the API module or a focused mapper, not scattered across render branches.
- Do not duplicate auth headers, base URLs, error parsing, or retry policy in individual components.
- Preserve the connector's cancellation and error contract. Pass an `AbortSignal` when the client supports it and do not swallow 401, validation, or network errors into a generic empty response.
- Keep multipart upload and blob download handling in the API module, returning a typed domain result or raw response only when headers or binary data are required.

## Query Keys

- Define query-key constants or factories beside the domain API functions.
- Make keys arrays with a stable domain identifier and every response-affecting parameter.

```ts
export const RECORD_QUERY_KEYS = {
  all: ['records'] as const,
  lists: ['records', 'list'] as const,
  list: (params: RecordListParams) => ['records', 'list', params] as const,
  detail: (id: string) => ['records', 'detail', id] as const,
}
```

- Include filters, search text, sort, pagination, selected IDs, and feature flags that alter the response.
- Keep key parameters serializable and normalized. Avoid hidden mutable state or values that change identity without changing meaning.
- Reuse the exact same key factory in queries, mutations, prefetching, invalidation, and hydration.
- Do not use a query for ephemeral UI state that is not server state.
- Treat a query key as a public contract inside the frontend. If a query and invalidation build parameter objects differently, they can silently leave stale data; use one factory rather than reconstructing keys inline.

## Queries

- Use `useQuery` for reads and keep the query function in the API layer.
- Use `enabled` for dependent queries instead of firing requests with incomplete identifiers.
- Debounce free-text search before adding it to query state and reset pagination when filters change.
- Distinguish initial loading from background refetching. Preserve useful existing data during pagination or filter refetches when the project supports placeholder data.
- Render explicit loading, error, empty, and success states. Do not hide an error behind an empty table.
- Select or map small response-to-option transformations in the query configuration when that keeps the component simple and typed.
- Keep shared QueryClient defaults centralized. Do not override retry, stale time, or focus behavior in every query without a reason.
- Guard response-dependent rendering with query state before dereferencing data. Avoid non-null assertions that only happen to work after the loading branch.

## Mutations And Cache

- Use `useMutation` for creates, updates, deletes, uploads, and other writes.
- Disable duplicate actions while a mutation is pending and expose a useful error state.
- After success, invalidate the smallest affected query keys. Include list and detail keys when both can be stale.
- Update the cache directly only when the response is authoritative and the update is simpler and safer than invalidation.
- Invalidate or reset pagination when a mutation changes membership or ordering.
- Keep optimistic updates limited to interactions where rollback is well-defined; otherwise prefer a successful mutation followed by focused invalidation.

```tsx
const updateMutation = useMutation({
  mutationFn: (payload: UpdateRecordPayload) => updateRecord(recordId, payload),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: RECORD_QUERY_KEYS.lists })
    await queryClient.invalidateQueries({ queryKey: RECORD_QUERY_KEYS.detail(recordId) })
  },
})
```

## Server Prefetch And Hydration

- If a route server-renders data that a client component also queries, prefetch or ensure the query on the server and hydrate it with the same key and request function contract.
- Keep server-only API helpers separate and mark them server-only where the project uses that convention.
- Pass only serializable data through the Server Component boundary. Never move secrets or server auth objects into client props.
- Avoid fetching the same resource through one contract on the server and a different contract on the client.
- If the project does not use hydration, keep the server fetch and client query responsibilities explicit rather than introducing hydration for a single screen.

## Pagination And Filters

- Keep table/filter state separate from server response state.
- Debounce search and normalize filters before creating the query key.
- Reset or clamp the current page when a filter can make the current page invalid.
- Keep the table usable while a background request is running; show a refetch indicator without replacing valid rows with a blank screen.
- Make empty results distinguishable from request failures.
- Keep table sorting, filtering, and pagination parameters normalized before they enter a key. The table skill owns the interaction model; this skill owns the request and cache contract.

## Review Checklist

- Transport lives in a typed domain API module and uses the shared connector.
- Query keys include every response-affecting input and are reused everywhere.
- Dependent queries use `enabled`; search is debounced; pagination responds to filter changes.
- Loading, refetching, error, empty, success, pending, and duplicate-submit states are intentional.
- Mutations invalidate the smallest correct set of queries and do not leave detail/list data stale.
- Server prefetch and client hydration, when used, share the exact same key and request contract.
- QueryClient policy is centralized and local overrides have a concrete reason.
- Components do not contain duplicated HTTP, auth, or response parsing logic.
