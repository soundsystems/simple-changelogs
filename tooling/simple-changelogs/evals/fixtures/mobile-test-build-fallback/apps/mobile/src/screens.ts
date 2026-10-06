// Synthetic, documented screen behavior for a note-writing fixture.
export const screens = {
  Cart: {
    controls: ["Refresh"],
    expected: "Loaded contents stay visible during refresh",
  },
  Catalog: {
    controls: ["Filters", "Clear all"],
    expected: "Latest selection wins; Clear all removes filters",
  },
};
