import { test } from "node:test";
import assert from "node:assert/strict";

class CommandPaletteState {
  public isOpen: boolean = false;
  public search: string = "";
  public selectedIndex: number = 0;

  open() {
    this.isOpen = true;
    this.search = "";
    this.selectedIndex = 0;
  }

  typeSearch(query: string) {
    this.search = query;
    this.selectedIndex = 0;
  }

  selectIndex(index: number) {
    this.selectedIndex = index;
  }

  close() {
    this.isOpen = false;
  }
}

test("reopening CommandPalette resets stale search query and selectedIndex", () => {
  const palette = new CommandPaletteState();
  palette.open();

  palette.typeSearch("audit logs");
  palette.selectIndex(3);

  assert.equal(palette.search, "audit logs");
  assert.equal(palette.selectedIndex, 3);

  // User closes palette
  palette.close();
  assert.equal(palette.isOpen, false);

  // User hits Cmd+K again
  palette.open();
  assert.equal(palette.isOpen, true);
  assert.equal(palette.search, "", "Search query must be cleared upon reopening");
  assert.equal(palette.selectedIndex, 0, "Selected index must be reset to 0 upon reopening");
});
