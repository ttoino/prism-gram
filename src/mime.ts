import PostalMime, { Address } from "postal-mime";

import {
    HEADERS_BLACKLIST_PATTERN,
    HEADERS_WHITELIST_PATTERN,
} from "./constants";

export const decode = async (
    stream: ReadableStream<Uint8Array<ArrayBufferLike>>,
) => {
    const reader = stream.getReader();

    try {
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        // Convert to string
        const decoder = new TextDecoder();
        const rawContent = decoder.decode(
            new Uint8Array(
                chunks.reduce(
                    (acc, chunk) => [...acc, ...chunk],
                    [] as number[],
                ),
            ),
        );

        return rawContent;
    } finally {
        reader.releaseLock();
    }
};

const postalMime = new PostalMime();

const normalizeAddress = (address?: Address): EmailAddress[] =>
    address
        ? address.group
            ? normalizeAddresses(address.group)
            : [
                  {
                      email: address.address,
                      name: address.name,
                  },
              ]
        : [];

const normalizeAddresses = (addresses?: Address[]): EmailAddress[] =>
    addresses?.flatMap(normalizeAddress) ?? [];

export const parseEmail = async (
    message: ForwardableEmailMessage,
) => {
    const rawMessage = await decode(message.raw);
    const parsedMessage = await postalMime.parse(rawMessage);

    return {
        attachments: parsedMessage.attachments.map((attachment) =>
            attachment.disposition === "attachment"
                ? {
                      content: attachment.content,
                      disposition: "attachment",
                      filename: attachment.filename ?? "",
                      type: attachment.mimeType,
                  }
                : {
                      content: attachment.content,
                      contentId: attachment.contentId ?? "",
                      disposition: "inline",
                      filename: attachment.filename ?? "",
                      type: attachment.mimeType,
                  },
        ),
        bcc: normalizeAddresses(parsedMessage.bcc),
        cc: normalizeAddresses(parsedMessage.cc),
        from: normalizeAddress(parsedMessage.from ?? parsedMessage.sender)[0],
        headers: Object.fromEntries(
            parsedMessage.headers
                .filter(
                    ({ key, value }) =>
                        !HEADERS_BLACKLIST_PATTERN.test(key) &&
                        HEADERS_WHITELIST_PATTERN.test(key) &&
                        !!value,
                )
                .map(({ key, value }) => [key, value]),
        ),
        html: parsedMessage.html,
        replyTo: normalizeAddresses(parsedMessage.replyTo).at(0),
        subject: parsedMessage.subject ?? "",
        text: parsedMessage.text,
        to: normalizeAddresses(parsedMessage.to),
    } satisfies Parameters<Env["EMAIL"]["send"]>[0];
};
