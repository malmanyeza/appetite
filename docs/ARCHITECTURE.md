# Appetite System Architecture

This document outlines the technical architecture of the Appetite Food Delivery MVP.

## Monorepo Structure

The project is structured as a monorepo to promote code sharing and consistency.

- `/mobile`: Expo (React Native) application for Customers and Drivers.
- `/dashboard`: Vite (React) application for Restaurants and Admins.
- `/shared`: Common TypeScript types and Zod schemas used across both platforms.
- `/supabase`: Database migrations, seed data, and configuration.

## Data Model

The system uses a centralized PostgreSQL database hosted on Supabase.

### Core Tables
- `profiles`: Unified user profiles linked to Supabase Auth.
- `restaurants`: Details of partner restaurants.
- `menu_items`: Menu catalogs for each restaurant.
- `orders`: Centralized order management.
- `order_items`: Line items for each order.
- `driver_profiles`: Additional metadata for delivery partners.

## Security (RLS)

Row Level Security is used to ensure data privacy:

- **Customers**: Can view all restaurants/menu items, but only their own orders and profile.
- **Restaurants**: Can manage their own menu and view orders assigned to their restaurant ID.
- **Drivers**: Can view "Ready for Pickup" orders and orders they are currently delivering.
- **Admins**: Full read/write access to all tables.

## Tech Stack

### Backend
- Supabase (Auth, DB, RLS, Storage)
- PostgreSQL

### Frontend (Mobile)
- React Native / Expo
- Zustand (Global State)
- TanStack React Query (Server State)
- Lucide Icons

### Frontend (Dashboard)
- React / Vite
- Tailwind CSS
- Zustand
- TanStack React Query
