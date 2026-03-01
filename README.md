# Appetite MVP - Food Delivery for Zimbabwe

Appetite is a premium food delivery platform tailored for the Zimbabwean market, featuring a multi-role ecosystem for Customers, Drivers, Restaurants, and Admins.

## Project Structure

- `/mobile`: Expo (React Native) app for Customers and Drivers.
- `/dashboard`: Vite (React) web app for Restaurants and Admins.
- `/shared`: Shared TypeScript types and Zod schemas.
- `/supabase`: Database migrations and RLS policies.
- `/docs`: Specification and setup instructions.

## Prerequisites

- Node.js (v18+)
- Expo CLI
- Supabase Account
- Git

## Getting Started

> [!IMPORTANT]
> For a detailed walkthrough of the backend and frontend setup, please refer to the [Setup Guide](file:///c:/Users/Malvern/Desktop/Malvern/2026%20Pojects/Appetite%20System%20Experiment/docs/SETUP_GUIDE.md).

1. **Clone the repository**
2. **Setup Shared Layer**
   ```bash
   cd shared
   npm install
   ```
3. **Setup Database**
   - Create a new project on [Supabase](https://supabase.com).
   - Run the initial migration SQL found in `supabase/migrations/`.
   - Add the seed data from `supabase/seed.sql`.
4. **Configure Dashboard**
   - `cd dashboard`
   - Copy `.env.example` to `.env`.
   - `npm install && npm run dev`.
5. **Configure Mobile**
   - `cd mobile`
   - Copy `.env.example` to `.env`.
   - `npm install && npx expo start`.

## Tech Stack

- **Frontend**: React (Web), React Native (Mobile)
- **Backend**: Supabase (Auth, Postgres, Storage)
- **State Management**: Zustand, TanStack Query
- **Styling**: Tailwind CSS (Web), Custom Theming (Mobile)
- **Validation**: Zod, React Hook Form
