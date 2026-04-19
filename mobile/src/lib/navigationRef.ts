import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Global navigation ref — attached to the NavigationContainer in App.tsx.
 * Used to navigate from outside React components (e.g. after auth state changes
 * cause the navigator to remount, wiping previous navigation history).
 */
export const navigationRef = createNavigationContainerRef();
