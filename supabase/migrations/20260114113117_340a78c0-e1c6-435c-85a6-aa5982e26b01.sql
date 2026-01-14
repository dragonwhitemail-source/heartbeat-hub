-- Add is_admin_invite column to track admin invite codes
ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS is_admin_invite boolean DEFAULT false;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_invite_codes_is_admin_invite ON public.invite_codes(is_admin_invite) WHERE is_admin_invite = true;