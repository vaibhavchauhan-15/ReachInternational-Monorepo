import { test } from "node:test";
import assert from "node:assert/strict";

class ClientDatasetFetcher {
  private requestId: number = 0;
  public committedData: string | null = null;
  public committedFilterKey: string | null = null;
  public isLoading: boolean = false;

  async load(filterKey: string, fetchFn: () => Promise<string>) {
    const currentId = ++this.requestId;
    this.isLoading = true;

    try {
      const data = await fetchFn();
      if (currentId === this.requestId) {
        this.committedData = data;
        this.committedFilterKey = filterKey;
      }
    } finally {
      if (currentId === this.requestId) {
        this.isLoading = false;
      }
    }
  }

  changeFilterKey() {
    this.requestId++;
    this.committedData = null;
    this.committedFilterKey = null;
  }
}

test("stale out-of-order response does not overwrite newer filterKey data", async () => {
  const fetcher = new ClientDatasetFetcher();

  let resolveA!: (val: string) => void;
  const slowFetchA = () =>
    new Promise<string>((resolve) => {
      resolveA = resolve;
    });

  let resolveB!: (val: string) => void;
  const fastFetchB = () =>
    new Promise<string>((resolve) => {
      resolveB = resolve;
    });

  // Start fetch for Filter A
  const pA = fetcher.load("dep-engineering", slowFetchA);

  // User quickly switches to Filter B
  fetcher.changeFilterKey();
  const pB = fetcher.load("dep-operations", fastFetchB);

  // Fast fetch B finishes first
  resolveB("operations-data");
  await pB;

  assert.equal(fetcher.committedData, "operations-data");
  assert.equal(fetcher.committedFilterKey, "dep-operations");
  assert.equal(fetcher.isLoading, false);

  // Slow fetch A finishes late
  resolveA("engineering-data");
  await pA;

  // Crucial assert: stale A must NOT have overwritten B
  assert.equal(
    fetcher.committedData,
    "operations-data",
    "Stale response from previous filterKey must be ignored"
  );
  assert.equal(fetcher.committedFilterKey, "dep-operations");
});
