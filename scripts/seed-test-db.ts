
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env.test") });
// Check for service role key
import fs from "fs";
let { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

// Fallback to e2e-env.json
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    try {
        const configPath = path.resolve(__dirname, "../e2e-env.json");
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            NEXT_PUBLIC_SUPABASE_URL = NEXT_PUBLIC_SUPABASE_URL || config.NEXT_PUBLIC_SUPABASE_URL;
            SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_SERVICE_ROLE_KEY;
        }
    } catch (e) {
        console.warn("Could not read e2e-env.json");
    }
}

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.test");
    process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const TEST_USER = {
    email: "test@rai.com",
    password: "password123",
    name: "E2E Test User",
};

async function seed() {
    console.log("🌱 Seeding Test Database...");

    // 1. Clean up existing test user
    // We first find the ID by email to delete from auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users.find(u => u.email === TEST_USER.email);
    if (existingUser) {
        console.log(`Removing existing user: ${existingUser.id}`);
        const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
        if (deleteError) throw deleteError;
    }

    // 2. Create Auth User
    console.log("Creating new Auth User...");
    const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email: TEST_USER.email,
        password: TEST_USER.password,
        email_confirm: true,
        user_metadata: { name: TEST_USER.name }
    });

    if (createError || !user) throw createError;
    console.log(`User created: ${user.id}`);

    // 3. Create Public Profile (Trigger usually handles this, but ensuring checks)
    // We'll update the profile created by trigger or insert if not exists
    console.log("Updating Public Profile...");
    const { error: profileError } = await supabase.from("users").upsert({
        id: user.id,
        email: TEST_USER.email,
        name: TEST_USER.name,
        plan: "starter",
        credits: 100,
        consents_completed: true,
        consents_completed_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

    // 4. Create Consents (Critical for Middleware)
    console.log("Creating User Consents...");
    const { error: consentError } = await supabase.from("user_consents").insert({
        user_id: user.id,
        terms_of_service: true,
        privacy_policy: true,
        third_party_data_guarantee: true, // Key for access
        marketing_consent: false,
    });
    if (consentError) throw consentError;

    console.log("✅ Seeding Complete!");
}

seed().catch((err) => {
    console.error("❌ Seeding Failed:", err);
    process.exit(1);
});
