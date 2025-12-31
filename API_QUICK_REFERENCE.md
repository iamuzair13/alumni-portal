# API Quick Reference Guide

## Quick API Endpoint Reference

### Events APIs

| Endpoint | Method | Purpose | Used In |
|----------|--------|---------|---------|
| `/api/events/home-past` | GET | Past events for homepage | `index.html` |
| `/api/events/home-upcoming` | GET | Upcoming events for homepage | `index.html` |
| `/api/events/home-coaching` | GET | Coaching events for homepage | `index.html` |
| `/api/events` | GET | All events with filters | `events/index.html` |
| `/api/events/[id]` | GET | Single event details | `event-details.html` |
| `/api/events/chapter/[chapterId]` | GET | Chapter-related events | `chapters/detail.html`, `associations/detail.html` |

### Chapters APIs

| Endpoint | Method | Purpose | Used In |
|----------|--------|---------|---------|
| `/api/chapters` | GET | All chapters | `chapters/index.html` |
| `/api/chapters/[id]` | GET | Single chapter details | `chapters/detail.html` |
| `/api/chapters/[id]/members` | GET | Chapter members | `chapters/detail.html` |
| `/api/chapters/[id]/member-count` | GET | Chapter member count | `chapters/detail.html`, `chapters/index.html` |
| `/api/chapters/member-counts` | GET | Batch member counts | `chapters/index.html`, `index.html` |

### Alumni APIs

| Endpoint | Method | Purpose | Used In |
|----------|--------|---------|---------|
| `/api/alumni/count` | GET | Total alumni count | `index.html`, `associations/detail.html` |
| `/api/alumni/association/[associationId]` | GET | Association members | `associations/detail.html` |

### Distinguished Alumni APIs

| Endpoint | Method | Purpose | Used In |
|----------|--------|---------|---------|
| `/api/distinguished-alumni` | GET | All stories | `index.html`, `stories/index.html` |
| `/api/distinguished-alumni/[slug]` | GET | Single story | `stories/detail.html` |

### Associations APIs

| Endpoint | Method | Purpose | Used In |
|----------|--------|---------|---------|
| `/api/associations` | GET | All associations | `associations/index.html` |
| `/api/associations/[id]` | GET | Single association | `associations/detail.html` |

---

## Frontend API Client Usage Examples

### Initialize API Client
```html
<script src="/assets/js/api-client.js"></script>
```

### Example: Fetch Past Events
```javascript
const { data, error } = await window.apiClient.getHomePastEvents(4);
if (error) {
  console.error('Error:', error);
} else {
  // Use data
  console.log('Events:', data);
}
```

### Example: Fetch Chapter Details
```javascript
const chapterId = 123;
const { data, error } = await window.apiClient.getChapterById(chapterId);
if (error) {
  console.error('Error:', error);
} else {
  // Use data
  console.log('Chapter:', data);
}
```

### Example: Fetch Chapter Members with Pagination
```javascript
const chapterId = 123;
const { data, count, pagination, error } = await window.apiClient.getChapterMembers(chapterId, {
  page: 1,
  limit: 20,
  sortBy: 'alumniname',
  order: 'asc'
});
```

### Example: Fetch Events with Filters
```javascript
const { data, pagination, error } = await window.apiClient.getEvents({
  category: 'Networking',
  type: 'upcoming',
  page: 1,
  limit: 12,
  search: 'alumni'
});
```

---

## Response Format

All APIs return data in this format:

```typescript
{
  data: any,           // The actual data (array or object)
  error: string | null // Error message if any, null otherwise
}
```

For paginated responses:
```typescript
{
  data: any[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  },
  error: string | null
}
```

---

## Common Query Parameters

### Pagination
- `page` - Page number (default: 1)
- `limit` - Items per page (default: varies by endpoint)

### Sorting
- `orderBy` - Field to sort by (default: varies)
- `order` - Sort direction: 'asc' or 'desc' (default: 'desc')

### Filtering
- `type` - Filter by type (e.g., 'past', 'upcoming')
- `category` - Filter by category
- `search` - Search term
- `isActive` - Filter by active status (true/false)
- `verifiedOnly` - Filter verified items (true/false, default: true)

---

## Migration Checklist

### Backend (Next.js)
- [ ] Set up database connection (`lib/db.ts`)
- [ ] Create all API route files
- [ ] Add environment variables
- [ ] Test all endpoints
- [ ] Add error handling
- [ ] Add input validation
- [ ] Configure CORS

### Frontend
- [ ] Create API client utility (`assets/js/api-client.js`)
- [ ] Update `index.html`
- [ ] Update `events/index.html`
- [ ] Update `event-details.html`
- [ ] Update `chapters/index.html`
- [ ] Update `chapters/detail.html`
- [ ] Update `chapters/national/index.html`
- [ ] Update `chapters/international/index.html`
- [ ] Update `associations/index.html`
- [ ] Update `associations/detail.html`
- [ ] Update `associations/medicine/index.html`
- [ ] Update `stories/index.html`
- [ ] Update `stories/detail.html`
- [ ] Update `assets/js/alumni-stories.js`
- [ ] Remove Supabase client code
- [ ] Test all pages
- [ ] Update API_BASE_URL in api-client.js

---

## Database Tables Reference

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `tbl_events` | Events and meetups | id, title, fromdate, category, type, image1 |
| `tbl_alumni` | Alumni members | alumniid, alumniname, degreetitle, verify, image1 |
| `tblchapters` | Chapter information | id, national_chapter, international_chapter, is_active |
| `alumni_chapter` | Alumni-chapter relationships | id, chapter1, chapter2, chapter3 |
| `distinguished_alumni` | Featured stories | slug, name, image, role, summary |
| `tbl_associations` | Faculty associations | id, name, description, image |
| `alumnichapterslocation` | Legacy chapter data | chapterid, chaptertitle, chapterlocation |

---

## Common Patterns

### Batch Operations
For fetching multiple counts or data:
```javascript
// Get member counts for multiple chapters
const ids = [1, 2, 3, 4, 5];
const { data } = await window.apiClient.getChapterMemberCounts(ids);
// Returns: { 1: 50, 2: 30, 3: 25, ... }
```

### Error Handling
```javascript
try {
  const { data, error } = await window.apiClient.getEvents();
  if (error) {
    // Handle API error
    showErrorMessage(error);
    return;
  }
  // Use data
  renderEvents(data);
} catch (error) {
  // Handle network/other errors
  console.error('Network error:', error);
  showErrorMessage('Failed to load events. Please try again.');
}
```

### Loading States
```javascript
async function loadData() {
  const container = document.getElementById('container');
  container.innerHTML = '<div class="loader">Loading...</div>';
  
  try {
    const { data, error } = await window.apiClient.getData();
    if (error) throw new Error(error);
    
    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available</p>';
      return;
    }
    
    container.innerHTML = renderData(data);
  } catch (error) {
    container.innerHTML = '<p class="error">Error loading data</p>';
  }
}
```

---

## Support

For detailed implementation guide, see `API_MIGRATION_GUIDE.md`

