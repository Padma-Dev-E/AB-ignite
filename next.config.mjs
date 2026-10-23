import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @returns {import('next').NextConfig} */
export default function nextConfig(phase) {
  return {
    // A production build must never overwrite a running dev server's assets.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
