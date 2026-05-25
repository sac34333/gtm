-- Add 'viewer' to the org_members role CHECK constraint
ALTER TABLE public.org_members DROP CONSTRAINT IF EXISTS org_members_role_check;
ALTER TABLE public.org_members ADD CONSTRAINT org_members_role_check CHECK (role IN ('owner', 'admin', 'member', 'viewer'));