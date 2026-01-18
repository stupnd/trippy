# Fix Avatar RLS Policy

The avatars are not showing because the Row Level Security (RLS) policy on the `profiles` table is too restrictive. It only allows users to read their own profile, but we need authenticated users to be able to read all profiles (so they can see other trip members' avatars).

## Quick Fix - Run in Supabase SQL Editor:

```sql
-- Drop existing restrictive SELECT policy if it exists
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create a new policy that allows authenticated users to read ALL profiles
CREATE POLICY "Authenticated users can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (true);
```

## Alternative: More Restrictive (If you prefer)

If you want to be more selective, you could allow users to only see profiles of users in their trips:

```sql
-- Drop existing policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create policy to view profiles of trip members
CREATE POLICY "Users can view profiles of trip members"
ON profiles
FOR SELECT
TO authenticated
USING (
  -- User can see their own profile
  auth.uid() = id
  OR
  -- User can see profiles of users who are in the same trip
  id IN (
    SELECT DISTINCT tm2.user_id
    FROM trip_members tm1
    JOIN trip_members tm2 ON tm1.trip_id = tm2.trip_id
    WHERE tm1.user_id = auth.uid()
    AND tm2.user_id IS NOT NULL
  )
);
```

## Verify the Fix

After running the SQL, refresh your trip dashboard. You should see:
- Console log showing more profiles fetched (not just 1)
- Avatars displaying for all members who have uploaded them

## Why This Happens

Supabase RLS policies are restrictive by default for security. The original policy only allowed:
- `auth.uid() = id` (users can only see their own profile)

But for avatars to show in trip members, we need users to be able to read other users' profiles when they're in the same trip.
