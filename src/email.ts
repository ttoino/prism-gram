import { env } from "cloudflare:workers";

import {
    FORWARDING_DOMAIN,
    FORWARDING_PATTERN,
    SENDING_DOMAIN,
    SENDING_PASSWORD,
    SENDING_PATTERN,
} from "./constants";
import { parseEmail } from "./mime";
import { getRule } from "./rules";

export const send = async (message: ForwardableEmailMessage) => {
    const match = message.to.match(SENDING_PATTERN);

    if (!match?.groups) return;

    const from = match.groups.from + "@" + FORWARDING_DOMAIN;
    const to = match.groups.to.replace("%", "@");

    console.log("Sending from", from, "to", to);

    const originalMessage = await parseEmail(message).catch((error: Error) =>
        console.error("Error parsing email", error.message),
    );

    if (!originalMessage) {
        message.setReject("Failed to parse email");
        return;
    }

    console.debug(originalMessage);

    if (originalMessage.to[0].name !== SENDING_PASSWORD) {
        console.warn("Wrong password!");
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
};

export const forward = async (message: ForwardableEmailMessage) => {
    if (!FORWARDING_PATTERN.test(message.to)) return;

    const forwardTo = await getRule(message.to);

    console.log("Forwarding to", forwardTo);

    const headers = new Headers({
        "Reply-To": `${message.to.replace(`@${FORWARDING_DOMAIN}`, "")}+${message.from.replace("@", "%")}@${SENDING_DOMAIN}`,
    });

    await Promise.all(
        [...forwardTo].map((address) =>
            message
                .forward(address, headers)
                .then((result) =>
                    console.debug("Forwarded the message", result),
                ),
        ),
    );
};
