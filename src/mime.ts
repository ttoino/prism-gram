import {
    extract,
    parseHeaders,
    type LetterparserAttachment,
} from "letterparser";
import {
    HEADERS_BLACKLIST_PATTERN,
    HEADERS_WHITELIST_PATTERN,
} from "./constants";

const decode = async (stream: ReadableStream<Uint8Array<ArrayBufferLike>>) => {
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

const convertAttachment = (
    attachment: LetterparserAttachment,
): EmailAttachment => ({
    content: attachment.body,
    contentId: attachment.contentId,
    disposition: "attachment",
    filename: attachment.filename,
    type: attachment.contentType,
});

export const parseEmail = async (
    message: ForwardableEmailMessage,
): Promise<Parameters<SendEmail["send"]>[0]> => {
    const rawMessage = await decode(message.raw);

    const extracted = extract(rawMessage);
    const headers = parseHeaders(rawMessage);

    return {
        attachments: extracted.attachments?.map(convertAttachment),
        from: extracted.from!,
        headers: Object.fromEntries(
            Object.entries(headers).filter(
                ([k, v]) =>
                    !HEADERS_BLACKLIST_PATTERN.test(k) &&
                    HEADERS_WHITELIST_PATTERN.test(k) &&
                    !!v,
            ) as [string, string][],
        ),
        html: extracted.html,
        subject: extracted.subject!,
        text: extracted.text,
        to: extracted.to!,
    };
};
