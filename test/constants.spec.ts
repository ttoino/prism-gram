import { describe, expect, it } from "vitest";

import {
    FORWARDING_PATTERN,
    HEADERS_BLACKLIST_PATTERN,
    HEADERS_WHITELIST_PATTERN,
    SENDING_PATTERN,
} from "../src/constants";

describe("SENDING_PATTERN", () => {
    it("matches valid send.toino.pt addresses and extracts groups", () => {
        const match = "from+to%domain.com@send.toino.pt".match(SENDING_PATTERN);

        expect(match).not.toBeNull();
        expect(match?.groups?.from).toBe("from");
        expect(match?.groups?.to).toBe("to%domain.com");
    });

    it("handles complex from names", () => {
        const match = "noreply+user%gmail.com@send.toino.pt".match(
            SENDING_PATTERN,
        );

        expect(match).not.toBeNull();
        expect(match?.groups?.from).toBe("noreply");
        expect(match?.groups?.to).toBe("user%gmail.com");
    });

    it("does not match plain send.toino.pt addresses", () => {
        const match = "user@send.toino.pt".match(SENDING_PATTERN);

        expect(match).toBeNull();
    });

    it("does not match addresses with multiple %", () => {
        const match = "a+b%c%d@send.toino.pt".match(SENDING_PATTERN);

        expect(match).toBeNull();
    });

    it("does not match forwarding domain", () => {
        const match = "user@toino.pt".match(SENDING_PATTERN);

        expect(match).toBeNull();
    });
});

describe("FORWARDING_PATTERN", () => {
    it("matches toino.pt addresses", () => {
        expect("user@toino.pt".match(FORWARDING_PATTERN)).not.toBeNull();
        expect("anything@toino.pt".match(FORWARDING_PATTERN)).not.toBeNull();
    });

    it("does not match send.toino.pt addresses", () => {
        expect("user@send.toino.pt".match(FORWARDING_PATTERN)).toBeNull();
    });

    it("does not match unrelated domains", () => {
        expect("user@example.com".match(FORWARDING_PATTERN)).toBeNull();
    });
});

describe("HEADERS_BLACKLIST_PATTERN", () => {
    it("matches blacklisted headers case-insensitively", () => {
        const blacklisted = [
            "From",
            "To",
            "Subject",
            "Content-Type",
            "Reply-To",
            "Message-ID",
            "DKIM-Signature",
            "ARC-Seal",
            "Bcc",
            "Cc",
        ];

        for (const header of blacklisted) {
            expect(HEADERS_BLACKLIST_PATTERN.test(header)).toBe(true);
        }
    });

    it("does not match whitelisted headers", () => {
        const whitelisted = [
            "X-Custom",
            "In-Reply-To",
            "List-Id",
            "Archived-At",
            "Organization",
        ];

        for (const header of whitelisted) {
            expect(HEADERS_BLACKLIST_PATTERN.test(header)).toBe(false);
        }
    });
});

describe("HEADERS_WHITELIST_PATTERN", () => {
    it("matches whitelisted headers", () => {
        const whitelisted = [
            "X-Custom",
            "X-Spam-Score",
            "In-Reply-To",
            "List-Id",
            "List-Archive",
            "Archived-At",
            "Organization",
            "Precedence",
            "References",
            "Content-Language",
        ];

        for (const header of whitelisted) {
            expect(HEADERS_WHITELIST_PATTERN.test(header)).toBe(true);
        }
    });

    it("does not match blacklisted headers", () => {
        const blacklisted = [
            "From",
            "To",
            "Subject",
            "Content-Type",
            "Received",
        ];

        for (const header of blacklisted) {
            expect(HEADERS_WHITELIST_PATTERN.test(header)).toBe(false);
        }
    });

    it("does not match arbitrary unknown headers", () => {
        expect(HEADERS_WHITELIST_PATTERN.test("Random-Header")).toBe(false);
        expect(HEADERS_WHITELIST_PATTERN.test("Foo-Bar")).toBe(false);
    });
});
