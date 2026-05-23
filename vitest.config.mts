import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [
        cloudflareTest({
            miniflare: {
                vars: {
                    SENDING_PASSWORD: "test-password",
                },
            },
            remoteBindings: false,
            wrangler: { configPath: "./wrangler.jsonc" },
        }),
    ],
    test: {
        exclude: ["node_modules/**", ".direnv/**"],
    },
});
