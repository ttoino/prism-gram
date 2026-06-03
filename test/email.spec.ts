import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FORWARDING_DOMAIN, SENDING_DOMAIN } from "../src/constants";
import { forward, send } from "../src/email";

const TEST_PASSWORD = "test-password";

const { getRule } = vi.hoisted(() => ({ getRule: vi.fn() }));

vi.mock("../src/rules", () => ({ getRule }));

function createMockEmailMessage(
    overrides: {
        from?: string;
        raw?: ReadableStream<Uint8Array>;
        to?: string;
    } = {},
) {
    return {
        forward: vi.fn().mockResolvedValue({ messageId: "<fwd@example.com>" }),
        from: overrides.from ?? "sender@example.com",
        headers: new Headers(),
        raw: overrides.raw ?? createRawMime(),
        rawSize: 0,
        reply: vi.fn().mockResolvedValue({ messageId: "<reply@example.com>" }),
        setReject: vi.fn(),
        to: overrides.to ?? "recipient@example.com",
    } satisfies ForwardableEmailMessage;
}

function createRawMime(
    overrides: { from?: string; to?: string } = {},
): ReadableStream<Uint8Array> {
    const from = overrides.from ?? "sender@example.com";
    const to = overrides.to ?? "recipient@example.com";

    const mime = [
        `From: ${from}`,
        `To: ${to}`,
        "Subject: Test Subject",
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        "Hello, world!",
    ].join("\r\n");

    return new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(mime));
            controller.close();
        },
    });
}

let sendSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    sendSpy = vi.spyOn(env.EMAIL, "send").mockResolvedValue({
        messageId: "<mock@example.com>",
    });
    getRule.mockResolvedValue(new Set(["dest@example.com"]));
});

afterEach(() => {
    sendSpy.mockRestore();
    vi.clearAllMocks();
});

describe("forward", () => {
    it("ignores addresses that are not on the forwarding domain", async () => {
        const message = createMockEmailMessage({ to: "user@example.com" });

        await forward(message);

        expect(getRule).not.toHaveBeenCalled();
        expect(message.forward).not.toHaveBeenCalled();
    });

    it("forwards to every address resolved by getRule", async () => {
        getRule.mockResolvedValue(new Set(["a@example.com", "b@example.com"]));
        const message = createMockEmailMessage({
            to: `alias@${FORWARDING_DOMAIN}`,
        });

        await forward(message);

        expect(getRule).toHaveBeenCalledWith(`alias@${FORWARDING_DOMAIN}`);
        expect(message.forward).toHaveBeenCalledTimes(2);
        expect(message.forward).toHaveBeenCalledWith(
            "a@example.com",
            expect.any(Headers),
        );
        expect(message.forward).toHaveBeenCalledWith(
            "b@example.com",
            expect.any(Headers),
        );
    });

    it("sets the Reply-To header so replies route back through sending", async () => {
        const message = createMockEmailMessage({
            from: "alice@example.com",
            to: `alias@${FORWARDING_DOMAIN}`,
        });

        await forward(message);

        const headers = message.forward.mock.calls[0][1] as Headers;
        expect(headers.get("Reply-To")).toBe(
            `alias+alice%example.com@${SENDING_DOMAIN}`,
        );
    });
});

describe("send", () => {
    it("ignores addresses that do not match the sending pattern", async () => {
        const message = createMockEmailMessage({
            to: `plain@${SENDING_DOMAIN}`,
        });

        await send(message);

        expect(message.setReject).not.toHaveBeenCalled();
        expect(sendSpy).not.toHaveBeenCalled();
    });

    it("rejects when the password does not match", async () => {
        const message = createMockEmailMessage({
            raw: createRawMime({
                to: `"wrong-password" <recipient@example.com>`,
            }),
            to: `from+to%domain@${SENDING_DOMAIN}`,
        });

        await send(message);

        expect(message.setReject).toHaveBeenCalledWith("Wrong password");
        expect(sendSpy).not.toHaveBeenCalled();
    });

    it("rejects when the email cannot be parsed", async () => {
        const message = createMockEmailMessage({
            raw: new ReadableStream({
                start(controller) {
                    controller.error(new Error("Stream error"));
                },
            }),
            to: `from+to%domain@${SENDING_DOMAIN}`,
        });

        await send(message);

        expect(message.setReject).toHaveBeenCalledWith("Failed to parse email");
        expect(sendSpy).not.toHaveBeenCalled();
    });

    it("sends via the EMAIL binding with the correct password", async () => {
        const message = createMockEmailMessage({
            raw: createRawMime({
                to: `"${TEST_PASSWORD}" <recipient@example.com>`,
            }),
            to: `noreply+user%gmail.com@${SENDING_DOMAIN}`,
        });

        await send(message);

        expect(message.setReject).not.toHaveBeenCalled();
        expect(sendSpy).toHaveBeenCalledOnce();

        const sent = sendSpy.mock.calls[0][0] as { from: string; to: string };
        expect(sent.from).toBe(`noreply@${FORWARDING_DOMAIN}`);
        expect(sent.to).toBe("user@gmail.com");
    });
});
