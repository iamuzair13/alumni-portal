# Next.js API Structure Template

## Project Structure

```
your-nextjs-app/
├── app/
│   ├── api/
│   │   ├── events/
│   │   │   ├── route.ts                    # GET /api/events
│   │   │   ├── home-past/
│   │   │   │   └── route.ts                # GET /api/events/home-past
│   │   │   ├── home-upcoming/
│   │   │   │   └── route.ts                # GET /api/events/home-upcoming
│   │   │   ├── home-coaching/
│   │   │   │   └── route.ts                # GET /api/events/home-coaching
│   │   │   ├── chapter/
│   │   │   │   └── [chapterId]/
│   │   │   │       └── route.ts            # GET /api/events/chapter/[chapterId]
│   │   │   └── [id]/
│   │   │       └── route.ts                # GET /api/events/[id]
│   │   ├── chapters/
│   │   │   ├── route.ts                    # GET /api/chapters
│   │   │   ├── member-counts/
│   │   │   │   └── route.ts                # GET /api/chapters/member-counts
│   │   │   └── [id]/
│   │   │       ├── route.ts                # GET /api/chapters/[id]
│   │   │       ├── members/
│   │   │       │   └── route.ts            # GET /api/chapters/[id]/members
│   │   │       └── member-count/
│   │   │           └── route.ts            # GET /api/chapters/[id]/member-count
│   │   ├── alumni/
│   │   │   ├── count/
│   │   │   │   └── route.ts                # GET /api/alumni/count
│   │   │   └── association/
│   │   │       └── [associationId]/
│   │   │           └── route.ts            # GET /api/alumni/association/[associationId]
│   │   ├── distinguished-alumni/
│   │   │   ├── route.ts                    # GET /api/distinguished-alumni
│   │   │   └── [slug]/
│   │   │       └── route.ts                # GET /api/distinguished-alumni/[slug]
│   │   └── associations/
│   │       ├── route.ts                    # GET /api/associations
│   │       └── [id]/
│   │           └── route.ts                # GET /api/associations/[id]
│   └── layout.tsx
├── lib/
│   └── db.ts                               # Database connection utility
├── .env.local                              # Environment variables
├── package.json
└── tsconfig.json
```

---

## Complete File Templates

### 1. Database Connection (`lib/db.ts`)

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Helper function to execute queries
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

// Helper function to execute transactions
export const transaction = async (callback: (client: any) => Promise<any>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

---

### 2. Environment Variables (`.env.local`)

```env
# Database Configuration
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_SSL=false

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
# Or for production:
# NEXT_PUBLIC_API_URL=https://your-nextjs-app.com

# Optional: Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

---

### 3. Package.json Dependencies

```json
{
  "name": "alumni-api",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/pg": "^8.10.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

### 4. TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

### 5. API Route Template (Example: `app/api/events/home-past/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '4', 10);

    // Validate input
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { data: null, error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Execute query
    const result = await query(
      `SELECT *
       FROM tbl_events
       WHERE category != 'Coaching and Mentorships'
         AND type = 'past'
       ORDER BY fromdate DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );

    // Return response
    return NextResponse.json({
      data: result.rows,
      error: null
    });
  } catch (error: any) {
    console.error('Error in /api/events/home-past:', error);
    return NextResponse.json(
      {
        data: null,
        error: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// Optional: Add caching headers
export const revalidate = 60; // Revalidate every 60 seconds
```

---

### 6. API Route with Pagination Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '12', 10);
    const offset = (page - 1) * limit;

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { data: null, error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    // Build query
    let queryStr = 'SELECT * FROM your_table WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    // Add filters here
    // if (someFilter) {
    //   paramCount++;
    //   queryStr += ` AND column = $${paramCount}`;
    //   params.push(someFilter);
    // }

    // Get total count
    const countQuery = queryStr.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Add pagination
    paramCount++;
    queryStr += ` LIMIT $${paramCount}`;
    params.push(limit);
    
    paramCount++;
    queryStr += ` OFFSET $${paramCount}`;
    params.push(offset);

    // Execute query
    const result = await query(queryStr, params);

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
  } catch (error: any) {
    console.error('Error in API route:', error);
    return NextResponse.json(
      {
        data: null,
        error: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
```

---

### 7. API Route with Dynamic Parameter Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate ID
    const id = parseInt(params.id, 10);
    if (isNaN(id) || id < 1) {
      return NextResponse.json(
        { data: null, error: 'Invalid ID parameter' },
        { status: 400 }
      );
    }

    // Execute query
    const result = await query(
      'SELECT * FROM your_table WHERE id = $1',
      [id]
    );

    // Check if found
    if (result.rows.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Resource not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: result.rows[0],
      error: null
    });
  } catch (error: any) {
    console.error('Error in API route:', error);
    return NextResponse.json(
      {
        data: null,
        error: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
```

---

### 8. Middleware for CORS (Optional: `middleware.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Handle CORS
  const response = NextResponse.next();
  
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'http://localhost:3000',
    'https://your-frontend-domain.com'
  ];

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

---

### 9. Error Handling Utility (`lib/errors.ts`)

```typescript
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function handleAPIError(error: unknown) {
  if (error instanceof APIError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode
    };
  }

  if (error instanceof Error) {
    return {
      error: process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'Internal server error',
      statusCode: 500
    };
  }

  return {
    error: 'Unknown error occurred',
    statusCode: 500
  };
}
```

---

### 10. Input Validation Utility (`lib/validation.ts`)

```typescript
export function validatePagination(page?: string, limit?: string) {
  const pageNum = parseInt(page || '1', 10);
  const limitNum = parseInt(limit || '12', 10);

  if (pageNum < 1) {
    throw new Error('Page must be greater than 0');
  }

  if (limitNum < 1 || limitNum > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  return { page: pageNum, limit: limitNum };
}

export function validateId(id: string, fieldName: string = 'ID') {
  const idNum = parseInt(id, 10);
  if (isNaN(idNum) || idNum < 1) {
    throw new Error(`Invalid ${fieldName}: must be a positive integer`);
  }
  return idNum;
}

export function sanitizeSearch(search: string): string {
  // Remove potentially dangerous characters
  return search.replace(/[<>'"&]/g, '').trim();
}
```

---

## Setup Instructions

1. **Initialize Next.js Project**
   ```bash
   npx create-next-app@latest alumni-api --typescript --app
   cd alumni-api
   ```

2. **Install Dependencies**
   ```bash
   npm install pg
   npm install -D @types/pg
   ```

3. **Create Directory Structure**
   ```bash
   mkdir -p app/api/{events,chapters,alumni,distinguished-alumni,associations}
   mkdir -p lib
   ```

4. **Copy Files**
   - Copy `lib/db.ts` to your project
   - Copy all API route files from the guide
   - Copy `.env.local` template and fill in your values

5. **Test Database Connection**
   ```typescript
   // test-db.ts
   import { query } from './lib/db';
   
   async function test() {
     try {
       const result = await query('SELECT NOW()');
       console.log('Database connected:', result.rows[0]);
     } catch (error) {
       console.error('Database connection failed:', error);
    }
   }
   test();
   ```

6. **Run Development Server**
   ```bash
   npm run dev
   ```

7. **Test API Endpoints**
   ```bash
   curl http://localhost:3000/api/events/home-past?limit=4
   ```

---

## Best Practices

1. **Always use parameterized queries** to prevent SQL injection
2. **Validate all input** before using in queries
3. **Handle errors gracefully** and return user-friendly messages
4. **Use appropriate HTTP status codes** (200, 400, 404, 500)
5. **Add logging** for debugging and monitoring
6. **Implement rate limiting** for production
7. **Use connection pooling** for database connections
8. **Add caching headers** where appropriate
9. **Document your API** endpoints
10. **Test thoroughly** before deploying

---

## Production Checklist

- [ ] Set up environment variables securely
- [ ] Configure database connection pooling
- [ ] Add rate limiting middleware
- [ ] Set up error monitoring (e.g., Sentry)
- [ ] Configure CORS properly
- [ ] Add API authentication if needed
- [ ] Set up logging and monitoring
- [ ] Add health check endpoint
- [ ] Configure caching strategies
- [ ] Set up CI/CD pipeline
- [ ] Load test your APIs
- [ ] Set up database backups

---

## Health Check Endpoint

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // Test database connection
    await query('SELECT 1');
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}
```

---

## Next Steps

1. Review the complete API_MIGRATION_GUIDE.md
2. Set up your Next.js project using this structure
3. Implement all API routes
4. Test each endpoint
5. Update frontend to use new APIs
6. Deploy and monitor

