# Getting Started with Appetite

Follow these steps to get the system running locally.

## 1. Supabase Backend Setup

Appetite uses Supabase for authentication and database management.

1.  **Create a Project**: Go to [Supabase](https://supabase.com) and create a new project.
2.  **Run Migrations**: 
    - Go to the **SQL Editor** in your Supabase dashboard.
    - Copy the contents of `supabase/migrations/20240101000000_initial_schema.sql` and run it. This creates all tables, triggers, and RLS policies.
    - (Optional) Run `supabase/seed.sql` to add sample data. *Note: You will need to replace the UUID placeholders with your actual user IDs after you sign up.*
3.  **Get API Keys**: 
    - Go to **Project Settings** -> **API**.
    - Copy the `Project URL` and `anon public` key.

## 2. Dashboard Setup (Web)

1.  Navigate to the dashboard directory:
    ```bash
    cd dashboard
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure Environment:
    - Create a `.env` file (copy from `.env.example`).
    - Paste your Supabase URL and Anon Key.
4.  Run the app:
    ```bash
    npm run dev
    ```
5.  Access at: `http://localhost:5173`

## 3. Mobile Setup (iOS/Android)

1.  Navigate to the mobile directory:
    ```bash
    cd mobile
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure Environment:
    - Create a `.env` file (copy from `.env.example`).
    - Paste your Supabase URL and Anon Key.
4.  Run with Expo:
    ```bash
    npx expo start
    ```
5.  **View the app**:
    - **Physical Device**: Download the **Expo Go** app and scan the QR code.
    - **Emulator**: Press `i` for iOS or `a` for Android (requires Xcode/Android Studio setup).

## 💡 Notes
- **Authentication**: You can sign up a new user via the mobile app or create one manually in the Supabase Auth dashboard.
- **Roles**: After signing up, go to the `profiles` table in Supabase and change the `role` column to `restaurant` or `admin` to access those dashboard features.
