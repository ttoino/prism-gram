import {
    FORWARDING_DOMAIN,
    FORWARDING_EMAIL_ADDRESSES,
    SENDING_DOMAIN,
    SENDING_PATTERN,
} from "./constants";
import { parseEmail } from "./mime";

export default {
    email: async (message, env) => {
        const match = message.to.match(SENDING_PATTERN);

        if (match?.groups) {
            const from = match.groups.from + "@" + FORWARDING_DOMAIN;
            const to = match.groups.to.replace("%", "@");

            console.debug("from", from, "to", to);

            const originalMessage = await parseEmail(message).catch(
                (error: Error) =>
                    console.error("Error parsing email", error.message),
            );

            if (!originalMessage) {
                message.setReject("Failed to parse email");
                return;
            }

            console.debug(
                "Parsed email",
                JSON.stringify(originalMessage, null, 4),
            );

            const password =
                process.env.SENDING_PASSWORD ?? env.SENDING_PASSWORD;

            if (originalMessage.to[0].name !== password) {
                console.warn("Wrong password!", "Expected", password);
                message.setReject("Wrong password");
                return;
            }

            const send: Parameters<SendEmail["send"]>[0] = {
                attachments: originalMessage.attachments,
                from,
                headers: originalMessage.headers,
                html: originalMessage.html,
                subject: originalMessage.subject,
                text: originalMessage.text,
                to,
            };

            const result = await env.EMAIL.send(send);

            console.debug("Sent the message", result);
        } else {
            const headers = new Headers({
                "Reply-To": `${message.to.replace(`@${FORWARDING_DOMAIN}`, "")}+${message.from.replace("@", "%")}@${SENDING_DOMAIN}`,
            });

            await Promise.all(
                FORWARDING_EMAIL_ADDRESSES.map((address) =>
                    message
                        .forward(address, headers)
                        .then((result) =>
                            console.debug("Forwarded the message", result),
                        ),
                ),
            );
        }
    },
} satisfies ExportedHandler<Env>;
