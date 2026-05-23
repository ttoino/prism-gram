import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
    test: {
        exclude: ["node_modules/**", ".direnv/**"],
        poolOptions: {
            workers: {
                defines: {
                    "process.env.SENDING_PASSWORD":
                        JSON.stringify("test-password"),
                },
                remoteBindings: false,
                wrangler: { configPath: "./wrangler.jsonc" },
            },
        },
    },
});
