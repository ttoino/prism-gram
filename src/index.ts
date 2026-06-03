import { forward, send } from "./email";

export default {
    email: async (message) => {
        await Promise.all([forward(message), send(message)]);
    },
} satisfies ExportedHandler<Env>;
