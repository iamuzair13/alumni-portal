# Leadership Filter Validation Matrix

## Status Filters

- [ ] `All` returns records across every status.
- [ ] `Pending` returns only `pending`.
- [ ] `Assessed` returns only `assessed`.
- [ ] `Approved` returns only `approved`.
- [ ] `Not Approved` returns only `rejected`.
- [ ] Switching statuses updates the dataset with no stale rows.

## Category Filters

- [ ] `All Categories` returns records from chapters and associations.
- [ ] `National Chapters` returns only chapter rows with national chapter tagging.
- [ ] `International Chapters` returns only chapter rows with international chapter tagging.
- [ ] `Associations` returns only association rows.

## Status + Category Combinations

- [ ] `All + National Chapters`
- [ ] `All + International Chapters`
- [ ] `All + Associations`
- [ ] `Pending + National Chapters`
- [ ] `Pending + International Chapters`
- [ ] `Pending + Associations`
- [ ] `Assessed + National Chapters`
- [ ] `Assessed + International Chapters`
- [ ] `Assessed + Associations`
- [ ] `Approved + National Chapters`
- [ ] `Approved + International Chapters`
- [ ] `Approved + Associations`
- [ ] `Not Approved + National Chapters`
- [ ] `Not Approved + International Chapters`
- [ ] `Not Approved + Associations`

## Clear Filters

- [ ] Clicking `Clear Filters` resets status to `All`.
- [ ] Clicking `Clear Filters` resets category to `All Categories`.
- [ ] Clicking `Clear Filters` resets type to `All Types`.
- [ ] Clicking `Clear Filters` resets role to `All Roles`.
- [ ] Clicking `Clear Filters` resets `With Achievements` toggle.
- [ ] Clicking `Clear Filters` clears search text.
- [ ] Clicking `Clear Filters` sets pagination to page 1.
- [ ] URL query parameters are removed after clear.
- [ ] Table data refreshes to default unfiltered dataset.
- [ ] Active sort order remains unchanged after clear.

## Edge Cases

- [ ] Empty dataset renders safely (no crashes).
- [ ] No matching records state is visible and correct.
- [ ] Page refresh preserves URL filter state and results.
- [ ] Browser back/forward restores previous filter state.
- [ ] Pagination still works after applying filters.
- [ ] Export output matches active filter state.
