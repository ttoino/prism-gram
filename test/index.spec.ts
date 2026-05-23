import {
    createExecutionContext,
    env,
    waitOnExecutionContext,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    FORWARDING_DOMAIN,
    FORWARDING_EMAIL_ADDRESSES,
    SENDING_DOMAIN,
} from "../src/constants";
import worker from "../src/index";

const TEST_PASSWORD = "test-password";

function createRawMime(
    overrides: {
        from?: string;
        subject?: string;
        text?: string;
        to?: string;
    } = {},
) {
    const from = overrides.from ?? "sender@example.com";
    const to = overrides.to ?? "recipient@example.com";
    const subject = overrides.subject ?? "Test Subject";
    const text = overrides.text ?? "Hello, world!";

    return [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        text,
    ].join("\r\n");
}

let sendSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    sendSpy = vi.spyOn(env.EMAIL, "send").mockResolvedValue({
        messageId: "<mock@example.com>",
    });
});

afterEach(() => {
    sendSpy.mockRestore();
});

function createMockEmailMessage(
    overrides: {
        from?: string;
        raw?: ReadableStream<Uint8Array>;
        to?: string;
    } = {},
) {
    const from = overrides.from ?? "sender@example.com";
    const to = overrides.to ?? "recipient@example.com";
    const mime = overrides.raw
        ? undefined
        : createRawMime({ from, to: to.replace("%", "@") });

    const raw =
        overrides.raw ??
        new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(mime));
                controller.close();
            },
        });

    return {
        forward: vi.fn().mockResolvedValue({ messageId: "<test@example.com>" }),
        from,
        headers: new Headers([
            ["from", from],
            ["to", to.replace("%", "@")],
            ["subject", "Test Subject"],
        ]),
        raw,
        rawSize: 0,
        reply: vi.fn().mockResolvedValue({ messageId: "<reply@example.com>" }),
        setReject: vi.fn(),
        to,
    } satisfies ForwardableEmailMessage;
}

describe("email handler — forwarding path", () => {
    it("forwards *@toino.pt emails to all configured addresses", async () => {
        const message = createMockEmailMessage({
            to: `user@${FORWARDING_DOMAIN}`,
        });
        const ctx = createExecutionContext();

        await worker.email(message, env, ctx);
        await waitOnExecutionContext(ctx);

        expect(message.setReject).not.toHaveBeenCalled();
        expect(message.forward).toHaveBeenCalledTimes(
            FORWARDING_EMAIL_ADDRESSES.length,
        );

        for (const address of FORWARDING_EMAIL_ADDRESSES) {
            expect(message.forward).toHaveBeenCalledWith(
                address,
                expect.any(Headers),
            );
        }
    });

    it("sets Reply-To header with correct format", async () => {
        const message = createMockEmailMessage({
            from: "alice@example.com",
            to: `localpart@${FORWARDING_DOMAIN}`,
        });
        const ctx = createExecutionContext();

        await worker.email(message, env, ctx);
        await waitOnExecutionContext(ctx);

        const forwardedCall = message.forward.mock.calls.find(
            ([address]) => address === FORWARDING_EMAIL_ADDRESSES[0],
        );
        expect(forwardedCall).toBeDefined();
        if (!forwardedCall) return;

        const headers = forwardedCall[1] as Headers;
        const replyTo = headers.get("Reply-To");
        expect(replyTo).toBe(`localpart+alice%example.com@${SENDING_DOMAIN}`);
    });
});

describe("email handler — sending path", () => {
    it("rejects send.toino.pt emails with wrong password", async () => {
        const message = createMockEmailMessage({
            to: `from+to%domain@${SENDING_DOMAIN}`,
        });
        const ctx = createExecutionContext();

        await worker.email(message, env, ctx);
        await waitOnExecutionContext(ctx);

        expect(message.setReject).toHaveBeenCalledWith("Wrong password");
        expect(sendSpy).not.toHaveBeenCalled();
    });

    it("sends via EMAIL binding with correct password", async () => {
        const message = createMockEmailMessage({
            from: "sender@example.com",
            raw: new ReadableStream({
                start(controller) {
                    controller.enqueue(
                        new TextEncoder().encode(
                            createRawMime({
                                from: "sender@example.com",
                                to: `"${TEST_PASSWORD}" <recipient@example.com>`,
                            }),
                        ),
                    );
                    controller.close();
                },
            }),
            to: `from+to%domain@${SENDING_DOMAIN}`,
        });
        const ctx = createExecutionContext();

        await worker.email(message, env, ctx);
        await waitOnExecutionContext(ctx);

        expect(message.setReject).not.toHaveBeenCalled();
        expect(sendSpy).toHaveBeenCalledOnce();

        const sent = (await sendSpy.mock.results[0].value) as {
            messageId: string;
        };
        expect(sent).toHaveProperty("messageId");
    });
});

describe("email handler — error handling", () => {
    it("rejects when parseEmail fails", async () => {
        const badStream = new ReadableStream({
            start(controller) {
                controller.error(new Error("Stream error"));
            },
        });

        const message = createMockEmailMessage({
            raw: badStream,
            to: `from+to%domain@${SENDING_DOMAIN}`,
        });
        const ctx = createExecutionContext();

        await worker.email(message, env, ctx);
        await waitOnExecutionContext(ctx);

        expect(message.setReject).toHaveBeenCalledWith("Failed to parse email");
        expect(sendSpy).not.toHaveBeenCalled();
        expect(message.forward).not.toHaveBeenCalled();
    });
});
