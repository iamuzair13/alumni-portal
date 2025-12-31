# API Migration Guide: Supabase to Next.js API Routes

## Overview
This guide documents the migration from direct Supabase client calls to Next.js API endpoints. All database queries will be moved to the Next.js backend for security and centralized data access.

**Important:** All SQL queries in this guide use **pure PostgreSQL syntax** - no Supabase-specific features. The queries are compatible with any standard PostgreSQL database.

---

## Database Tables Used

1. **tbl_events** - Events and meetups
2. **tbl_alumni** - Alumni member data
3. **tblchapters** - Chapter information
4. **alumni_chapter** - Alumni-chapter relationships
5. **distinguished_alumni** - Featured alumni stories
6. **tbl_associations** - Faculty associations
7. **alumnichapterslocation** - Legacy chapter location data (fallback)

---

## API Endpoints Mapping

### 1. Events APIs

#### 1.1 GET `/api/events/home-past`
**Purpose:** Fetch past events for homepage "Events and Meetups" section

**Query Parameters:**
- `limit` (optional, default: 4)

**Current Supabase Query:**
```javascript
.from('tbl_events')
.select('*')
.neq('category', 'Coaching and Mentorships')
.eq('type', 'past')
.order('fromdate', { ascending: false, nullsLast: true })
.limit(4)
```

**Used In:**
- `index.html` - `loadHomeEvents()` function

**Next.js API Route:**
```typescript
// app/api/events/home-past/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db'; // Your PostgreSQL connection

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '4', 10);

    const result = await query(`
      SELECT *
      FROM tbl_events
      WHERE category != 'Coaching and Mentorships'
        AND type = 'past'
      ORDER BY fromdate DESC NULLS LAST
      LIMIT $1
    `, [limit]);

    return NextResponse.json({ data: result.rows, error: null });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### 1.2 GET `/api/events/home-upcoming`
**Purpose:** Fetch upcoming events for homepage "Upcoming Engagements" section

**Query Parameters:**
- `limit` (optional, default: 4)

**Current Supabase Query:**
```javascript
.from('tbl_events')
.select('*')
.neq('category', 'Coaching and Mentorships')
.eq('type', 'upcoming')
.order('fromdate', { ascending: true, nullsLast: true })
.limit(4)
```

**Used In:**
- `index.html` - `loadUpcomingEngagements()` function

**Next.js API Route:**
```typescript
// app/api/events/home-upcoming/route.ts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '4', 10);

    const result = await query(`
      SELECT *
      FROM tbl_events
      WHERE category != 'Coaching and Mentorships'
        AND type = 'upcoming'
      ORDER BY fromdate ASC NULLS LAST
      LIMIT $1
    `, [limit]);

    return NextResponse.json({ data: result.rows, error: null });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### 1.3 GET `/api/events/home-coaching`
**Purpose:** Fetch coaching and mentorship events for homepage

**Query Parameters:**
- `limit` (optional, default: 3)

**Current Supabase Query:**
```javascript
.from('tbl_events')
.select('*')
.eq('category', 'Coaching and Mentorships')
.order('fromdate', { ascending: false, nullsLast: true })
.limit(3)
```

**Used In:**
- `index.html` - `loadHomeCoachingEvents()` function

**Next.js API Route:**
```typescript
// app/api/events/home-coaching/route.ts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '3', 10);

    const result = await query(`
      SELECT *
      FROM tbl_events
      WHERE category = 'Coaching and Mentorships'
      ORDER BY fromdate DESC NULLS LAST
      LIMIT $1
    `, [limit]);

    return NextResponse.json({ data: result.rows, error: null });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### 1.4 GET `/api/events`
**Purpose:** Fetch all events with filtering and pagination

**Query Parameters:**
- `category` (optional) - Filter by category
- `type` (optional) - Filter by type (past/upcoming)
- `search` (optional) - Search in title/description
- `page` (optional, default: 1)
- `limit` (optional, default: 12)
- `orderBy` (optional, default: 'fromdate')
- `order` (optional, default: 'desc')

**Used In:**
- `events/index.html` - Main events listing page

**Next.js API Route:**
```typescript
// app/api/events/route.ts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '12', 10);
    const orderByParam = searchParams.get('orderBy') || 'fromdate';
    const orderParam = searchParams.get('order') || 'desc';
    const offset = (page - 1) * limit;

    // Whitelist allowed columns for ORDER BY to prevent SQL injection
    const allowedOrderByColumns = ['fromdate', 'title', 'created_at', 'id'];
    const orderBy = allowedOrderByColumns.includes(orderByParam) ? orderByParam : 'fromdate';
    
    // Validate order direction
    const order = orderParam.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let query = 'SELECT * FROM tbl_events WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (type) {
      paramCount++;
      query += ` AND type = $${paramCount}`;
      params.push(type);
    }

    if (search) {
      paramCount++;
      query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Add ordering and pagination (orderBy is whitelisted, safe to use)
    query += ` ORDER BY ${orderBy} ${order} NULLS LAST LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await query(query, params);

    return NextResponse.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      error: null
    });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### 1.5 GET `/api/events/[id]`
**Purpose:** Fetch single event by ID

**Route Parameters:**
- `id` - Event ID

**Used In:**
- `event-details.html` - Event detail page

**Next.js API Route:**
```typescript
// app/api/events/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await query(
      'SELECT * FROM tbl_events WHERE id = $1',
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result.rows[0], error: null });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### 1.6 GET `/api/events/chapter/[chapterId]`
**Purpose:** Fetch events related to a specific chapter

**Route Parameters:**
- `chapterId` - Chapter ID

**Query Parameters:**
- `limit` (optional, default: 3)

**Used In:**
- `chapters/detail.html` - Chapter detail page
- `associations/detail.html` - Association detail page

**Next.js API Route:**
```typescript
// app/api/events/chapter/[chapterId]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { chapterId: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '3', 10);

    const result = await query(`
      SELECT *
      FROM tbl_events
      WHERE chapter_id = $1
      ORDER BY fromdate DESC NULLS LAST
      LIMIT $2
    `, [params.chapterId, limit]);

    return NextResponse.json({ data: result.rows, error: null });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

### 2. Chapters APIs

#### 2.1 GET `/api/chapters`
**Purpose:** Fetch all chapters

**Query Parameters:**
- `type` (optional) - Filter by type (national/international)
- `isActive` (optional) - Filter by active status

**Used In:**
- `chapters/index.html` - Main chapters listing
- `chapters/national/index.html` - National chapters
- `chapters/international/index.html` - International chapters

**Next.js API Route:**
```typescript
// app/api/chapters/route.ts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');

    let query = 'SELECT * FROM tblchapters WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (type) {
      paramCount++;
      if (type === 'national') {
        query += ` AND national_chapter IS NOT NULL`;
      } else if (type === 'international') {
        query += ` AND international_chapter IS NOT NULL`;
      }
    }

    if (isActive !== null) {
      paramCount++;
      query += ` AND is_active = $${paramCount}`;
      params.push(isActive === 'true');
    }

    query += ' ORDER BY id ASC';

    const result = await query(query, params);
    return NextResponse.json({ data: result.rows, error: null });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### 2.2 GET `/api/chapters/[id]`
**Purpose:** Fetch single chapter by ID

**Route Parameters:**
- `id` - Chapter ID

**Used In:**
- `chapters/detail.html` - Chapter detail page

**Next.js API Route:**
```typescript
// app/api/chapters/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Try tblchapters first
    let result = await query(
      'SELECT * FROM tblchapters WHERE id = $1',
      [params.id]
    );

    // Fallback to alumnichapterslocation for backward compatibility
    if (result.rows.length === 0) {
      result = await query(
        'SELECT * FROM alumnichapterslocation WHERE chapterid = $1',
        [params.id]
      );

      if (result.rows.length > 0) {
        const locationChapter = result.rows[0];
        return NextResponse.json({
          data: {
            id: locationChapter.chapterid,
            national_chapter: locationChapter.chaptertitle,
            international_chapter: null,
            chapter_whatsapp: locationChapter.chapterwhatsapp,
            chapter_image: null,
            is_active: true,
            description: `Chapter located in ${locationChapter.chapterlocation}`,
            cities: locationChapter.chapterlocation
          },
          error: null
        });
      }
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Chapter not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result.rows[0], error: null });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### 2.3 GET `/api/chapters/[id]/members`
**Purpose:** Fetch members of a specific chapter

**Route Parameters:**
- `id` - Chapter ID

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 20)
- `sortBy` (optional, default: 'alumniname')
- `order` (optional, default: 'asc')
- `verifiedOnly` (optional, default: true)

**Used In:**
- `chapters/detail.html` - Chapter detail page member listing

**Next.js API Route:**
```typescript
// app/api/chapters/[id]/members/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortByParam = searchParams.get('sortBy') || 'alumniname';
    const orderParam = searchParams.get('order') || 'asc';
    const verifiedOnly = searchParams.get('verifiedOnly') !== 'false';
    const offset = (page - 1) * limit;

    // Whitelist allowed columns for ORDER BY to prevent SQL injection
    const allowedSortColumns = ['alumniname', 'degreetitle', 'yearofending', 'alumniid'];
    const sortBy = allowedSortColumns.includes(sortByParam) ? sortByParam : 'alumniname';
    
    // Validate order direction
    const order = orderParam.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const chapterId = parseInt(params.id, 10);

    // Step 1: Get alumni_chapter records for this chapter
    const chapterMembersResult = await query(`
      SELECT id
      FROM alumni_chapter
      WHERE chapter1 = $1 OR chapter2 = $1 OR chapter3 = $1
    `, [chapterId]);

    if (chapterMembersResult.rows.length === 0) {
      return NextResponse.json({
        data: [],
        count: 0,
        pagination: { page, limit, total: 0, totalPages: 0 },
        error: null
      });
    }

    const alumniIds = chapterMembersResult.rows.map(row => row.id);

    // Step 2: Fetch verified alumni details with pagination
    let queryStr = `
      SELECT alumniid, alumniname, degreetitle, yearofending, image1
      FROM tbl_alumni
      WHERE alumniid = ANY($1)
    `;
    const queryParams: any[] = [alumniIds];

    if (verifiedOnly) {
      queryStr += ' AND verify = $2';
      queryParams.push('true');
    }

    // Get total count
    const countQuery = queryStr.replace(
      'SELECT alumniid, alumniname, degreetitle, yearofending, image1',
      'SELECT COUNT(*) as total'
    );
    const countResult = await query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Add sorting and pagination (sortBy is whitelisted, safe to use)
    queryStr += ` ORDER BY ${sortBy} ${order} LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await query(queryStr, queryParams);

    return NextResponse.json({
      data: result.rows,
      count: total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      error: null
    });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### 2.4 GET `/api/chapters/[id]/member-count`
**Purpose:** Get total member count for a chapter

**Route Parameters:**
- `id` - Chapter ID

**Used In:**
- `chapters/index.html` - Chapter listing with counts
- `chapters/national/index.html` - National chapters
- `chapters/international/index.html` - International chapters
- `chapters/detail.html` - Chapter detail page

**Next.js API Route:**
```typescript
// app/api/chapters/[id]/member-count/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const chapterId = parseInt(params.id, 10);

    // Get alumni IDs for this chapter
    const chapterMembersResult = await query(`
      SELECT id
      FROM alumni_chapter
      WHERE chapter1 = $1 OR chapter2 = $1 OR chapter3 = $1
    `, [chapterId]);

    if (chapterMembersResult.rows.length === 0) {
      return NextResponse.json({ count: 0, error: null });
    }

    const alumniIds = chapterMembersResult.rows.map(row => row.id);

    // Count verified alumni
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM tbl_alumni
      WHERE alumniid = ANY($1) AND verify = $2
    `, [alumniIds, 'true']);

    return NextResponse.json({
      count: parseInt(countResult.rows[0].total),
      error: null
    });
  } catch (error) {
    return NextResponse.json(
      { count: 0, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### 2.5 GET `/api/chapters/member-counts`
**Purpose:** Get member counts for multiple chapters (batch)

**Query Parameters:**
- `ids` - Comma-separated chapter IDs

**Used In:**
- `chapters/index.html` - Bulk loading chapter counts
- `index.html` - Homepage chapter counts

**Next.js API Route:**
```typescript
// app/api/chapters/member-counts/route.ts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const idsParam = searchParams.get('ids');

    if (!idsParam) {
      return NextResponse.json(
        { data: {}, error: 'ids parameter required' },
        { status: 400 }
      );
    }

    const chapterIds = idsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    if (chapterIds.length === 0) {
      return NextResponse.json({ data: {}, error: null });
    }

    // Get all alumni_chapter records for these chapters
    const chapterMembersResult = await query(`
      SELECT id, chapter1, chapter2, chapter3
      FROM alumni_chapter
      WHERE chapter1 = ANY($1) OR chapter2 = ANY($1) OR chapter3 = ANY($1)
    `, [chapterIds]);

    // Group alumni IDs by chapter
    const chapterAlumniMap: { [key: number]: number[] } = {};
    chapterIds.forEach(id => {
      chapterAlumniMap[id] = [];
    });

    chapterMembersResult.rows.forEach(row => {
      [row.chapter1, row.chapter2, row.chapter3].forEach((chapterId, index) => {
        if (chapterId && chapterIds.includes(chapterId)) {
          chapterAlumniMap[chapterId].push(row.id);
        }
      });
    });

    // Count verified alumni for each chapter
    const counts: { [key: number]: number } = {};

    for (const [chapterId, alumniIds] of Object.entries(chapterAlumniMap)) {
      if (alumniIds.length === 0) {
        counts[parseInt(chapterId)] = 0;
        continue;
      }

      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM tbl_alumni
        WHERE alumniid = ANY($1) AND verify = $2
      `, [alumniIds, 'true']);

      counts[parseInt(chapterId)] = parseInt(countResult.rows[0].total);
    }

    return NextResponse.json({ data: counts, error: null });
  } catch (error) {
    return NextResponse.json(
      { data: {}, error: error.message },
      { status: 500 }
    );
  }
}
```

---

### 3. Alumni APIs

#### 3.1 GET `/api/alumni/count`
**Purpose:** Get total verified alumni count

**Query Parameters:**
- `associationId` (optional) - Filter by association

**Used In:**
- `index.html` - Homepage statistics
- `associations/detail.html` - Association member count

**Next.js API Route:**
```typescript
// app/api/alumni/count/route.ts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const associationId = searchParams.get('associationId');

    let query = 'SELECT COUNT(*) as total FROM tbl_alumni WHERE verify = $1';
    const params = ['true'];

    if (associationId) {
      query += ' AND association_id = $2';
      params.push(associationId);
    }

    const result = await query(query, params);
    return NextResponse.json({
      count: parseInt(result.rows[0].total),
      error: null
    });
  } catch (error) {
    return NextResponse.json(
      { count: 0, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### 3.2 GET `/api/alumni/association/[associationId]`
**Purpose:** Fetch alumni members of an association

**Route Parameters:**
- `associationId` - Association ID

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 20)
- `verifiedOnly` (optional, default: true)

**Used In:**
- `associations/detail.html` - Association member listing
- `associations/medicine/index.html` - Medicine association

**Next.js API Route:**
```typescript
// app/api/alumni/association/[associationId]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { associationId: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const verifiedOnly = searchParams.get('verifiedOnly') !== 'false';
    const offset = (page - 1) * limit;

    let query = `
      SELECT alumniid, alumniname, degreetitle, yearofending, image1
      FROM tbl_alumni
      WHERE association_id = $1
    `;
    const queryParams: any[] = [params.associationId];

    if (verifiedOnly) {
      query += ' AND verify = $2';
      queryParams.push('true');
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT alumniid, alumniname, degreetitle, yearofending, image1',
      'SELECT COUNT(*) as total'
    );
    const countResult = await query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Add pagination
    query += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await query(query, queryParams);

    return NextResponse.json({
      data: result.rows,
      count: total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      error: null
    });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

### 4. Distinguished Alumni APIs

#### 4.1 GET `/api/distinguished-alumni`
**Purpose:** Fetch distinguished alumni stories

**Query Parameters:**
- `limit` (optional, default: 20)
- `orderBy` (optional, default: 'created_at')
- `order` (optional, default: 'desc')

**Used In:**
- `index.html` - Homepage distinguished alumni slider
- `stories/index.html` - Stories listing page
- `assets/js/alumni-stories.js` - Stories JavaScript module

**Next.js API Route:**
```typescript
// app/api/distinguished-alumni/route.ts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const orderByParam = searchParams.get('orderBy') || 'created_at';
    const orderParam = searchParams.get('order') || 'desc';

    // Whitelist allowed columns for ORDER BY to prevent SQL injection
    const allowedOrderByColumns = ['created_at', 'name', 'slug', 'id'];
    const orderBy = allowedOrderByColumns.includes(orderByParam) ? orderByParam : 'created_at';
    
    // Validate order direction
    const order = orderParam.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const result = await query(`
      SELECT slug, name, image, role, summary
      FROM distinguished_alumni
      ORDER BY ${orderBy} ${order}
      LIMIT $1
    `, [limit]);

    return NextResponse.json({ data: result.rows, error: null });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### 4.2 GET `/api/distinguished-alumni/[slug]`
**Purpose:** Fetch single distinguished alumni story by slug

**Route Parameters:**
- `slug` - Alumni story slug

**Used In:**
- `stories/detail.html` - Story detail page
- `assets/js/alumni-stories.js` - Story detail fetching

**Next.js API Route:**
```typescript
// app/api/distinguished-alumni/[slug]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const result = await query(
      'SELECT * FROM distinguished_alumni WHERE slug = $1',
      [params.slug]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Story not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result.rows[0], error: null });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

### 5. Associations APIs

#### 5.1 GET `/api/associations`
**Purpose:** Fetch all associations

**Used In:**
- `associations/index.html` - Associations listing

**Next.js API Route:**
```typescript
// app/api/associations/route.ts
export async function GET(request: NextRequest) {
  try {
    const result = await query(
      'SELECT * FROM tbl_associations ORDER BY id ASC'
    );

    return NextResponse.json({ data: result.rows, error: null });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### 5.2 GET `/api/associations/[id]`
**Purpose:** Fetch single association by ID

**Route Parameters:**
- `id` - Association ID

**Used In:**
- `associations/detail.html` - Association detail page
- `associations/medicine/index.html` - Medicine association page

**Next.js API Route:**
```typescript
// app/api/associations/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await query(
      'SELECT * FROM tbl_associations WHERE id = $1',
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Association not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result.rows[0], error: null });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## Frontend Migration Guide

### Step 1: Create API Client Utility

Create a utility file to handle all API calls:

```javascript
// assets/js/api-client.js

const API_BASE_URL = 'https://your-nextjs-app.com/api'; // Replace with your Next.js app URL

class APIClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Events
  async getHomePastEvents(limit = 4) {
    return this.request(`/events/home-past?limit=${limit}`);
  }

  async getHomeUpcomingEvents(limit = 4) {
    return this.request(`/events/home-upcoming?limit=${limit}`);
  }

  async getHomeCoachingEvents(limit = 3) {
    return this.request(`/events/home-coaching?limit=${limit}`);
  }

  async getEvents(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/events?${params}`);
  }

  async getEventById(id) {
    return this.request(`/events/${id}`);
  }

  async getChapterEvents(chapterId, limit = 3) {
    return this.request(`/events/chapter/${chapterId}?limit=${limit}`);
  }

  // Chapters
  async getChapters(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/chapters?${params}`);
  }

  async getChapterById(id) {
    return this.request(`/chapters/${id}`);
  }

  async getChapterMembers(id, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/chapters/${id}/members?${params}`);
  }

  async getChapterMemberCount(id) {
    return this.request(`/chapters/${id}/member-count`);
  }

  async getChapterMemberCounts(ids) {
    const idsParam = ids.join(',');
    return this.request(`/chapters/member-counts?ids=${idsParam}`);
  }

  // Alumni
  async getAlumniCount(associationId = null) {
    const params = associationId ? `?associationId=${associationId}` : '';
    return this.request(`/alumni/count${params}`);
  }

  async getAssociationAlumni(associationId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/alumni/association/${associationId}?${params}`);
  }

  // Distinguished Alumni
  async getDistinguishedAlumni(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/distinguished-alumni?${params}`);
  }

  async getDistinguishedAlumniBySlug(slug) {
    return this.request(`/distinguished-alumni/${slug}`);
  }

  // Associations
  async getAssociations() {
    return this.request('/associations');
  }

  async getAssociationById(id) {
    return this.request(`/associations/${id}`);
  }
}

// Export singleton instance
const apiClient = new APIClient();
window.apiClient = apiClient; // Make available globally
```

---

### Step 2: Update Frontend Code

#### Example: Update `index.html` - `loadHomeEvents()`

**Before (Supabase):**
```javascript
async function loadHomeEvents() {
  const grid = document.getElementById('home-events-grid');
  if (!grid || !supabaseClient) return;

  try {
    const { data: dbEvents, error } = await supabaseClient
      .from('tbl_events')
      .select('*')
      .neq('category', 'Coaching and Mentorships')
      .eq('type', 'past')
      .order('fromdate', { ascending: false, nullsLast: true })
      .limit(4);

    if (error) throw error;
    // ... rest of the code
  } catch (error) {
    console.error('Error loading homepage events:', error);
  }
}
```

**After (Next.js API):**
```javascript
async function loadHomeEvents() {
  const grid = document.getElementById('home-events-grid');
  if (!grid || !window.apiClient) return;

  try {
    const { data: dbEvents, error } = await window.apiClient.getHomePastEvents(4);

    if (error) throw new Error(error);
    
    if (!dbEvents || dbEvents.length === 0) {
      grid.innerHTML = '<div class="col-12"><p class="mb-0">No events available right now. Please check back soon.</p></div>';
      return;
    }

    // ... rest of the rendering code remains the same
  } catch (error) {
    console.error('Error loading homepage events:', error);
    grid.innerHTML = '<div class="col-12"><p class="mb-0">Error loading events. Please refresh the page.</p></div>';
  }
}
```

---

### Step 3: Remove Supabase Client Initialization

Remove all Supabase client initialization code:

**Remove:**
```javascript
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  const SUPABASE_URL = '...';
  const SUPABASE_ANON_KEY = '...';
  const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
</script>
```

**Replace with:**
```html
<script src="/assets/js/api-client.js"></script>
```

---

## Page-to-API Mapping Summary

| Page/File | APIs Used |
|-----------|-----------|
| `index.html` | `/api/events/home-past`<br>`/api/events/home-upcoming`<br>`/api/events/home-coaching`<br>`/api/distinguished-alumni`<br>`/api/chapters/member-counts`<br>`/api/alumni/count` |
| `events/index.html` | `/api/events` |
| `event-details.html` | `/api/events/[id]` |
| `chapters/index.html` | `/api/chapters`<br>`/api/chapters/member-counts` |
| `chapters/national/index.html` | `/api/chapters?type=national`<br>`/api/chapters/member-counts` |
| `chapters/international/index.html` | `/api/chapters?type=international`<br>`/api/chapters/member-counts` |
| `chapters/detail.html` | `/api/chapters/[id]`<br>`/api/chapters/[id]/members`<br>`/api/chapters/[id]/member-count`<br>`/api/events/chapter/[chapterId]` |
| `associations/index.html` | `/api/associations`<br>`/api/alumni/count` |
| `associations/detail.html` | `/api/associations/[id]`<br>`/api/alumni/association/[associationId]`<br>`/api/alumni/count?associationId=[id]`<br>`/api/events/chapter/[chapterId]` |
| `associations/medicine/index.html` | `/api/associations/[id]`<br>`/api/alumni/association/[associationId]`<br>`/api/events/chapter/[chapterId]` |
| `stories/index.html` | `/api/distinguished-alumni` |
| `stories/detail.html` | `/api/distinguished-alumni/[slug]` |
| `assets/js/alumni-stories.js` | `/api/distinguished-alumni`<br>`/api/distinguished-alumni/[slug]` |

---

## Next.js Database Connection Setup

Create a database connection utility in your Next.js app:

```typescript
// lib/db.ts
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error', { text, error });
    throw error;
  }
};
```

---

## Environment Variables

Add these to your Next.js `.env.local`:

```env
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_SSL=false
NEXT_PUBLIC_API_URL=https://your-nextjs-app.com
```

---

## PostgreSQL Compatibility Notes

✅ **All queries use pure PostgreSQL syntax:**
- Standard SQL: `SELECT`, `FROM`, `WHERE`, `ORDER BY`, `LIMIT`, `OFFSET`
- PostgreSQL array operations: `ANY($1)` for array matching
- PostgreSQL string functions: `ILIKE` for case-insensitive search
- PostgreSQL NULL handling: `NULLS LAST` in ORDER BY clauses
- Parameterized queries: All values use `$1`, `$2`, etc. placeholders

**No Supabase-specific features used:**
- ✅ Converted `.in()` → `ANY($1)` with array parameter
- ✅ Converted `.or()` → `WHERE col1 = $1 OR col2 = $1`
- ✅ Converted `.maybeSingle()` → Check `result.rows.length === 0`
- ✅ Converted `.neq()` → `WHERE column != $1`
- ✅ Converted `.eq()` → `WHERE column = $1`

**Dynamic ORDER BY Security:**
- All dynamic ORDER BY clauses use whitelisting to prevent SQL injection
- Only pre-approved column names are allowed
- Order direction is validated (ASC/DESC only)

## Security Considerations

1. **Input Validation**: Always validate and sanitize input parameters
2. **SQL Injection Prevention**: 
   - Use parameterized queries for all values (already implemented above)
   - **Whitelist column names** for dynamic ORDER BY clauses (implemented above)
   - Never concatenate user input directly into SQL queries
3. **Rate Limiting**: Implement rate limiting on API routes
4. **CORS**: Configure CORS properly for your frontend domain
5. **Authentication**: Add authentication middleware if needed for protected routes
6. **Error Handling**: Don't expose sensitive database errors to clients

---

## Testing Checklist

- [ ] All API endpoints return correct data structure
- [ ] Error handling works correctly
- [ ] Pagination works as expected
- [ ] Filtering and sorting work correctly
- [ ] Image URLs are properly formatted
- [ ] Frontend displays data correctly
- [ ] Loading states work properly
- [ ] Error states display user-friendly messages
- [ ] Performance is acceptable (consider caching)

---

## Migration Steps

1. **Phase 1**: Set up Next.js API routes (all endpoints)
2. **Phase 2**: Create API client utility
3. **Phase 3**: Update one page at a time, starting with `index.html`
4. **Phase 4**: Test thoroughly
5. **Phase 5**: Remove Supabase client code
6. **Phase 6**: Deploy and monitor

---

## Notes

- All API responses follow the format: `{ data: any, error: string | null }`
- Image paths are handled the same way (using `buildEventImagePath` or similar functions)
- Date formatting remains the same on the frontend
- The database schema is unchanged, so queries translate directly

---

## Support

For questions or issues during migration, refer to:
- Next.js API Routes Documentation: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- PostgreSQL Node.js Client: https://node-postgres.com/

