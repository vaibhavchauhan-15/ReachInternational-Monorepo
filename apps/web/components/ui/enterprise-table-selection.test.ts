import { test } from "node:test";
import assert from "node:assert/strict";

interface TableItem {
  id: string;
  name: string;
}

function computeAllSelected(data: TableItem[], selectedIds: string[]): boolean {
  return data.length > 0 && data.every((item) => selectedIds.includes(item.id));
}

test("false positive prevented when selectedIds count equals different page data length", () => {
  // Page 1: user selected 3 items: ["1", "2", "3"]
  const page1Data: TableItem[] = [
    { id: "1", name: "Item 1" },
    { id: "2", name: "Item 2" },
    { id: "3", name: "Item 3" },
    { id: "4", name: "Item 4" },
    { id: "5", name: "Item 5" },
  ];
  const selectedIds = ["1", "2", "3"];

  // Page 2: has 3 items: ["6", "7", "8"]
  const page2Data: TableItem[] = [
    { id: "6", name: "Item 6" },
    { id: "7", name: "Item 7" },
    { id: "8", name: "Item 8" },
  ];

  // Old flawed calculation: selectedIds.length === page2Data.length -> 3 === 3 -> true (BUG!)
  const flawedOldCalculation = page2Data.length > 0 && selectedIds.length === page2Data.length;
  assert.equal(flawedOldCalculation, true, "Demonstrates flawed old calculation returning true");

  // Fixed calculation: checks that every item in page2Data is in selectedIds
  const isAllSelected = computeAllSelected(page2Data, selectedIds);
  assert.equal(isAllSelected, false, "Must return false because items 6, 7, 8 are not selected");
});

test("returns true only when every current data item is selected", () => {
  const currentData: TableItem[] = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];

  assert.equal(computeAllSelected(currentData, ["a"]), false);
  assert.equal(computeAllSelected(currentData, ["a", "b"]), true);
  assert.equal(computeAllSelected(currentData, ["a", "b", "c"]), true); // Includes previous page selections too
});
