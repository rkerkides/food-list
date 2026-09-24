import type { NextConfig } from "next";

/**
 * `standalone` output is what the Docker image runs, but Netlify's Next.js
 * runtime builds (and serves) the default output. Keeping the switch behind an
 * env var means the same repo builds correctly for both targets.
 */
const standaloneOutput = process.env.BUILD_TARGET === "docker";

const nextConfig: NextConfig = {
  // Keep development tooling from generating agent-instruction files in the repository.
  agentRules: false,
  output: standaloneOutput ? "standalone" : undefined,
  // better-sqlite3 and pg are native/node-only modules used inside the server runtime.
  serverExternalPackages: ["better-sqlite3", "pg"],
  typedRoutes: false,
};

export default nextConfig;
