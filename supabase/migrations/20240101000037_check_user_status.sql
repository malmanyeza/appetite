-- Migration: Add RPC to check user existence and confirmation status
-- This enables better feedback in the "Forgot Password" flow.

CREATE OR REPLACE FUNCTION public.check_user_status(email_text text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Use SECURITY DEFINER to access auth.users
AS $$
DECLARE
    user_record RECORD;
BEGIN
    SELECT confirmed_at, id INTO user_record
    FROM auth.users
    WHERE email = email_text
    LIMIT 1;

    IF user_record.id IS NULL THEN
        RETURN json_build_object('exists', false, 'confirmed', false);
    END IF;

    RETURN json_build_object(
        'exists', true, 
        'confirmed', (user_record.confirmed_at IS NOT NULL)
    );
END;
$$;

-- Grant access to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.check_user_status(text) TO anon, authenticated;
