
ALTER TABLE users
ADD COLUMN IF NOT EXISTS signup_provider TEXT DEFAULT 'email';


DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_provider TEXT;
    v_existing_user_id UUID;
BEGIN
    -- Provider 寃곗젙: Google OAuth vs Email
    -- auth.users??raw_app_meta_data?먯꽌 provider ?뺤씤
    v_provider := COALESCE(
        NEW.raw_app_meta_data->>'provider',
        'email'
    );

    -- ?숈씪 ?대찓?쇱쓽 湲곗〈 ?ъ슜?먭? ?덈뒗吏 ?뺤씤
    SELECT id INTO v_existing_user_id
    FROM public.users
    WHERE email = NEW.email
    LIMIT 1;

    IF v_existing_user_id IS NOT NULL THEN
        -- 湲곗〈 ?ъ슜?먭? ?덉쑝硫????덉퐫???앹꽦?섏? ?딆쓬
        -- (Supabase媛 auth.identities濡??곌껐 泥섎-)
        RETURN NEW;
    END IF;

    -- ???ъ슜???앹꽦
    INSERT INTO public.users (
        id,
        email,
        name,
        avatar_url,
        signup_provider
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name'
        ),
        NEW.raw_user_meta_data->>'avatar_url',
        v_provider
    )
    ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, public.users.name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

UPDATE users
SET signup_provider = 'google'
WHERE avatar_url LIKE '%googleusercontent.com%'
  AND signup_provider = 'email';

