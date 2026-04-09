// src/shared/lib/demoMode.js
// Single source of truth for demo mode detection.
// Derived purely from pathname: /demo/* → demo, everything else → prod.
// Import DEMO_MODE from here instead of checking env vars directly.

import { isDemoEnvironment } from "./environment";

export const DEMO_MODE = isDemoEnvironment();
