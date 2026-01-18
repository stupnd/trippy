# Profile Setup Instructions

## Required Supabase Setup

### 1. Create `profiles` Table

Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 2. Create `avatars` Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "Create bucket"
3. Name: `avatars`
4. Public bucket: **Yes** (check the box)
5. File size limit: 5242880 (5MB recommended)
6. Allowed MIME types: `image/*` (optional, but recommended)
7. Click "Create bucket"

### 3. Set Storage Policies

**Important:** Even if the bucket is public, you may need storage policies for uploads.

#### Option A: Via Dashboard (Easiest)
1. Go to Storage → avatars bucket
2. Click "Policies" tab
3. Click "New Policy" → "Create policy from scratch"
4. **For INSERT (Upload):**
   - Policy name: `Allow authenticated uploads`
   - Allowed operation: `INSERT`
   - Target roles: `authenticated`
   - USING expression: `auth.role() = 'authenticated'`
   - WITH CHECK expression: `auth.role() = 'authenticated'`
   - Save
5. **For SELECT (Read):**
   - Policy name: `Allow public read`
   - Allowed operation: `SELECT`
   - Target roles: `public`
   - USING expression: `bucket_id = 'avatars'`
   - Save

#### Option B: Via SQL Editor
```sql
-- Allow authenticated users to upload avatars
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Allow public to read avatars
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

## Verification

After setup:
1. Try uploading an avatar - should work now!
2. Try saving your profile name/bio - should work now!
3. Check the browser console - no more 404 errors!
