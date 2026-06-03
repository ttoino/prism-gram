import { describe, expect, it, vi } from "vitest";

import { getRule } from "../src/rules";

const { ADDRESSES, addressList, ruleList, RULES } = vi.hoisted(() => ({
    ADDRESSES: [
        { email: "verified-a@example.com", verified: "2024-01-01T00:00:00Z" },
        { email: "verified-b@example.com", verified: "2024-01-01T00:00:00Z" },
        // Unverified — must be excluded from the default set.
        { email: "unverified@example.com", verified: null },
        // Verified but no email — must be excluded.
        { email: null, verified: "2024-01-01T00:00:00Z" },
    ],
    addressList: vi.fn(),
    ruleList: vi.fn(),
    RULES: [
        // Valid literal/to rule forwarding to two destinations.
        {
            actions: [
                {
                    type: "forward",
                    value: ["dest-a@example.com", "dest-b@example.com"],
                },
            ],
            matchers: [
                { field: "to", type: "literal", value: "alias@toino.pt" },
            ],
        },
        // Mixed actions — only the forward action contributes.
        {
            actions: [
                { type: "worker", value: ["ignored-worker"] },
                { type: "forward", value: ["only@example.com"] },
            ],
            matchers: [
                { field: "to", type: "literal", value: "mixed@toino.pt" },
            ],
        },
        // More than one matcher — skipped.
        {
            actions: [{ type: "forward", value: ["nope@example.com"] }],
            matchers: [
                { field: "to", type: "literal", value: "multi@toino.pt" },
                { field: "to", type: "literal", value: "extra@toino.pt" },
            ],
        },
        // Non-literal matcher — skipped.
        {
            actions: [{ type: "forward", value: ["nope@example.com"] }],
            matchers: [{ type: "all" }],
        },
        // Matcher on the wrong field — skipped.
        {
            actions: [{ type: "forward", value: ["nope@example.com"] }],
            matchers: [
                { field: "from", type: "literal", value: "sender@toino.pt" },
            ],
        },
    ],
}));

vi.mock("cloudflare", () => {
    const iter = <T>(items: T[]) => ({
        async *[Symbol.asyncIterator]() {
            yield* items;
        },
    });

    addressList.mockImplementation(() => iter(ADDRESSES));
    ruleList.mockImplementation(() => iter(RULES));

    return {
        default: class {
            emailRouting = {
                addresses: { list: addressList },
                rules: { list: ruleList },
            };
        },
    };
});

describe("getRule", () => {
    it("returns the forward set for an address with a matching rule", async () => {
        const rule = await getRule("alias@toino.pt");

        expect([...rule].sort()).toEqual([
            "dest-a@example.com",
            "dest-b@example.com",
        ]);
    });

    it("only keeps forward actions, ignoring other action types", async () => {
        const rule = await getRule("mixed@toino.pt");

        expect([...rule]).toEqual(["only@example.com"]);
    });

    it("falls back to the verified address set for unknown addresses", async () => {
        const rule = await getRule("unknown@toino.pt");

        expect([...rule].sort()).toEqual([
            "verified-a@example.com",
            "verified-b@example.com",
        ]);
    });

    it("excludes unverified addresses and entries without an email", async () => {
        const rule = await getRule("unknown@toino.pt");

        expect(rule.has("unverified@example.com")).toBe(false);
        expect(rule.size).toBe(2);
    });

    it("ignores rules with more than one matcher", async () => {
        const rule = await getRule("multi@toino.pt");

        // Falls back to the default set instead of forwarding.
        expect(rule.has("nope@example.com")).toBe(false);
        expect(rule.has("verified-a@example.com")).toBe(true);
    });

    it("loads the Cloudflare data only once across calls", async () => {
        await getRule("alias@toino.pt");
        await getRule("unknown@toino.pt");
        await getRule("mixed@toino.pt");

        expect(addressList).toHaveBeenCalledTimes(1);
        expect(ruleList).toHaveBeenCalledTimes(1);
    });
});
