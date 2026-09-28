import { describe, expect, it } from "vitest";

import { decode, parseEmail } from "../src/mime";

function createRawStream(content: string): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(content));
            controller.close();
        },
    });
}

describe("decode", () => {
    it("reads a ReadableStream into a string", async () => {
        const stream = createRawStream("Hello, world!");
        const result = await decode(stream);

        expect(result).toBe("Hello, world!");
    });

    it("handles multi-chunk streams", async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode("Hello, "));
                controller.enqueue(new TextEncoder().encode("world!"));
                controller.close();
            },
        });

        const result = await decode(stream);
        expect(result).toBe("Hello, world!");
    });
});

describe("parseEmail", () => {
    it("extracts basic fields from a simple MIME message", async () => {
        const mime = [
            "From: sender@example.com",
            'To: "Display Name" <recipient@example.com>',
            "Subject: Hello",
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=UTF-8",
            "",
            "Body text here",
        ].join("\r\n");

        const message = {
            from: "sender@example.com",
            headers: new Headers(),
            raw: createRawStream(mime),
            rawSize: 0,
            reply: () => Promise.resolve({ messageId: "" }),
            setReject: () => {},
            to: "recipient@example.com",
        } as unknown as ForwardableEmailMessage;

        const result = await parseEmail(message);

        expect(result.from).toEqual({
            email: "sender@example.com",
            name: "",
        });
        expect(result.subject).toBe("Hello");
        expect(result.text).toBe("Body text here\n");
        expect(result.html).toBe("");
        expect(result.to).toEqual([
            {
                email: "recipient@example.com",
                name: "Display Name",
            },
        ]);
    });

    it("filters headers by whitelist and blacklist", async () => {
        const mime = [
            "From: sender@example.com",
            "To: recipient@example.com",
            "Subject: Test",
            "X-Custom-Header: value",
            "In-Reply-To: <msg123>",
            "Content-Type: text/plain",
            "",
            "Body",
        ].join("\r\n");

        const message = {
            from: "sender@example.com",
            headers: new Headers(),
            raw: createRawStream(mime),
            rawSize: 0,
            reply: () => Promise.resolve({ messageId: "" }),
            setReject: () => {},
            to: "recipient@example.com",
        } as unknown as ForwardableEmailMessage;

        const result = await parseEmail(message);

        // Blacklisted headers should be removed
        expect(result.headers).not.toHaveProperty("from");
        expect(result.headers).not.toHaveProperty("to");
        expect(result.headers).not.toHaveProperty("subject");
        expect(result.headers).not.toHaveProperty("content-type");

        // Whitelisted custom headers should be kept
        expect(result.headers).toHaveProperty("x-custom-header");
        expect(result.headers).toHaveProperty("in-reply-to");
    });

    it("drops unknown headers not in whitelist", async () => {
        const mime = [
            "From: sender@example.com",
            "To: recipient@example.com",
            "Subject: Test",
            "Unknown-Header: should-be-dropped",
            "Content-Type: text/plain",
            "",
            "Body",
        ].join("\r\n");

        const message = {
            from: "sender@example.com",
            headers: new Headers(),
            raw: createRawStream(mime),
            rawSize: 0,
            reply: () => Promise.resolve({ messageId: "" }),
            setReject: () => {},
            to: "recipient@example.com",
        } as unknown as ForwardableEmailMessage;

        const result = await parseEmail(message);

        expect(result.headers).not.toHaveProperty("unknown-header");
    });

    it("converts attachments", async () => {
        const boundary = "----=_Part_123";
        const mime = [
            "From: sender@example.com",
            "To: recipient@example.com",
            "Subject: With Attachment",
            `Content-Type: multipart/mixed; boundary="${boundary}"`,
            "",
            `--${boundary}`,
            "Content-Type: text/plain",
            "",
            "Body text",
            `--${boundary}`,
            'Content-Type: application/pdf; name="doc.pdf"',
            'Content-Disposition: attachment; filename="doc.pdf"',
            "Content-Transfer-Encoding: base64",
            "",
            "dGVzdA==",
            `--${boundary}--`,
        ].join("\r\n");

        const message = {
            from: "sender@example.com",
            headers: new Headers(),
            raw: createRawStream(mime),
            rawSize: 0,
            reply: () => Promise.resolve({ messageId: "" }),
            setReject: () => {},
            to: "recipient@example.com",
        } as unknown as ForwardableEmailMessage;

        const result = await parseEmail(message);

        expect(result.attachments).toHaveLength(1);
        const attachment = result.attachments?.[0];
        expect(attachment).toBeDefined();
        expect(attachment).toMatchObject({
            disposition: "attachment",
            filename: "doc.pdf",
        });
    });

    it("handles messages with no body", async () => {
        const mime = [
            "From: sender@example.com",
            "To: recipient@example.com",
            "Subject: Empty",
            "Content-Type: text/plain",
            "",
            "",
        ].join("\r\n");

        const message = {
            from: "sender@example.com",
            headers: new Headers(),
            raw: createRawStream(mime),
            rawSize: 0,
            reply: () => Promise.resolve({ messageId: "" }),
            setReject: () => {},
            to: "recipient@example.com",
        } as unknown as ForwardableEmailMessage;

        const result = await parseEmail(message);

        expect(result.text).toBe("");
        expect(result.html).toBe("");
        expect(result.attachments).toEqual([]);
    });
});
