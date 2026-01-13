-- ================================================
-- Migration: Add Missing Columns to Users Table
-- Purpose: Add columns from tbl_users that are needed for full migration
-- ================================================

-- Add firstname column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'firstname'
    ) THEN
        ALTER TABLE public.users ADD COLUMN firstname character varying;
        RAISE NOTICE 'Added firstname column to users table';
    END IF;
END $$;

-- Add lastname column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'lastname'
    ) THEN
        ALTER TABLE public.users ADD COLUMN lastname character varying;
        RAISE NOTICE 'Added lastname column to users table';
    END IF;
END $$;

-- Add department column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'department'
    ) THEN
        ALTER TABLE public.users ADD COLUMN department character varying;
        RAISE NOTICE 'Added department column to users table';
    END IF;
END $$;

-- Add blocked column (maps to is_active, but keeping for compatibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'blocked'
    ) THEN
        ALTER TABLE public.users ADD COLUMN blocked boolean DEFAULT false;
        RAISE NOTICE 'Added blocked column to users table';
    END IF;
END $$;

-- Add lastlogindatetime column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'lastlogindatetime'
    ) THEN
        ALTER TABLE public.users ADD COLUMN lastlogindatetime character varying;
        RAISE NOTICE 'Added lastlogindatetime column to users table';
    END IF;
END $$;

-- Add type column (legacy role type)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'type'
    ) THEN
        ALTER TABLE public.users ADD COLUMN type character varying;
        RAISE NOTICE 'Added type column to users table';
    END IF;
END $$;

-- Add password column (for compatibility, password_hash is the primary field)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'password'
    ) THEN
        ALTER TABLE public.users ADD COLUMN password text;
        -- Copy password_hash to password for existing users
        UPDATE public.users SET password = password_hash WHERE password IS NULL;
        RAISE NOTICE 'Added password column to users table and synced with password_hash';
    END IF;
END $$;

-- Sync blocked with is_active (blocked = !is_active)
DO $$
BEGIN
    UPDATE public.users 
    SET blocked = NOT is_active
    WHERE blocked IS NULL;
    RAISE NOTICE 'Synced blocked column with is_active';
END $$;

-- Add comments
DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'firstname') THEN
        COMMENT ON COLUMN public.users.firstname IS 'User first name (from tbl_users migration)';
    END IF;
END $$;

DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'lastname') THEN
        COMMENT ON COLUMN public.users.lastname IS 'User last name (from tbl_users migration)';
    END IF;
END $$;

DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'department') THEN
        COMMENT ON COLUMN public.users.department IS 'User department (from tbl_users migration)';
    END IF;
END $$;

DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'blocked') THEN
        COMMENT ON COLUMN public.users.blocked IS 'User blocked status (from tbl_users migration). Maps to !is_active';
    END IF;
END $$;

DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'lastlogindatetime') THEN
        COMMENT ON COLUMN public.users.lastlogindatetime IS 'Last login datetime (from tbl_users migration)';
    END IF;
END $$;

DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'type') THEN
        COMMENT ON COLUMN public.users.type IS 'Legacy role type (admin, superadmin, viewer) - use user_roles for new RBAC';
    END IF;
END $$;

DO $$ BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password') THEN
        COMMENT ON COLUMN public.users.password IS 'Legacy password field (for compatibility). Use password_hash as primary.';
    END IF;
END $$;
