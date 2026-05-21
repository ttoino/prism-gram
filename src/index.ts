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

        if (match) {
            const password = match["password"];
            const from = match["from"] + "@" + FORWARDING_DOMAIN;
            const to = match["to"].replace("%", "@");

            console.debug("from", from, "to", to);

            if (password !== env.SENDING_PASSWORD) {
                console.warn("Wrong password!");
                message.setReject("Wrong password");
                return;
            }

            const originalMessage = await parseEmail(message);

            console.debug("Parsed email", originalMessage);

            const send: Parameters<SendEmail["send"]>[0] = {
                ...originalMessage,
                from,
                to,
            };

            const result = await env.EMAIL.send(send);

            console.debug("Send the message", result);
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
