import {
    extract,
    type LetterparserMail,
    type LetterparserAttachment,
    parseHeaders,
} from "letterparser";

const replyToPattern = /^reply\+(.+)\+(.+)@toino\.pt$/;

const blacklistedHeaderPattern =
    /^(?:ARC-.*|Bcc|Cc|CFBL-Address|CFBL-Feedback-ID|Content-Transfer-Encoding|Content-Type|Date|DKIM-Signature|Feedback-ID|From|Message-ID|MIME-Version|Received|Reply-To|Return-Path|Subject|TLS-Report-Domain|TLS-Report-Submitter|TLS-Required|To)$/i;

const whitelistedHeaderPattern = /^(?:Archived-At|Auto-Submitted|Comments|Content-Language|Importance|In-Reply-To|Keywords|List-Archive|List-Help|List-Id|List-Owner|List-Post|List-Subscribe|List-Unsubscribe-Post|List-Unsubscribe|Organization|Precedence|References|Require-Recipient-Valid-Since|Sensitivity|X-[A-Za-z0-9\-_]+)$/i;

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
    filename: attachment.filename,
    type: attachment.contentType,
    contentId: attachment.contentId,
    disposition: "attachment",
});

const convertMailbox = (mailbox: LetterparserMail["from"] & object): string =>
    mailbox.address;

export default {
    email: async (message, env, ctx) => {
        console.debug("Received an email", message);

        const match = message.to.match(replyToPattern);

        console.debug("Tested the address", match);

        if (match) {
            console.debug("The address does match, replying");

            const originalFrom = match[1].replace("%", "@");
            const originalTo = match[2].replace("%", "@");

            console.debug(
                "Parsed the address:",
                "from",
                originalFrom,
                "to",
                originalTo,
            );

            const rawMessage = await decode(message.raw);

            console.debug("Decoded the message", rawMessage);

            const originalMessage = extract(rawMessage);

            console.debug("Parsed the message", originalMessage);

            const originalHeaders = parseHeaders(rawMessage);

            console.debug("Parsed the message headers", originalHeaders);

            const reply: Parameters<SendEmail["send"]>[0] = {
                from: originalTo,
                to: originalFrom,
                cc: originalMessage.cc?.map(convertMailbox),
                bcc: originalMessage.bcc?.map(convertMailbox),
                subject: originalMessage.subject ?? "Re: ",
                text: originalMessage.text,
                html: originalMessage.html,
                attachments:
                    originalMessage.attachments?.map(convertAttachment),
                headers: Object.fromEntries(
                    Object.entries(originalHeaders).filter(
                        ([k, v]) => !blacklistedHeaderPattern.test(k) && whitelistedHeaderPattern.test(k) && !!v,
                    ) as [string, string][],
                ),
            };

            console.debug("Replying", reply);

            const result = await env.EMAIL.send(reply);

            console.debug("Replied", result);
        } else {
            console.debug("The address does not match, forwarding");

            const result = await message.forward(
                "joaoapereira21@hotmail.com",
                new Headers({
                    "Reply-To": `reply+${message.from.replace("@", "%")}+${message.to.replace("@", "%")}@toino.pt`,
                }),
            );

            console.debug("Forwarded the message", result);
        }
    },
} satisfies ExportedHandler<Env>;
