import Cloudflare from "cloudflare";

import { ACCOUNT_ID, API_TOKEN, ZONE_ID } from "./constants";

const addresses = new Set<string>();
const rules = new Map<string, Set<string>>();

let loaded: Promise<void> | undefined;

const load = async () => {
    const client = new Cloudflare({ apiToken: API_TOKEN });

    for await (const address of client.emailRouting.addresses.list({
        account_id: ACCOUNT_ID,
    }))
        if (address.verified && address.email) addresses.add(address.email);

    for await (const rule of client.emailRouting.rules.list({
        zone_id: ZONE_ID,
    })) {
        if (rule.matchers?.length !== 1 || !rule.actions) continue;

        const to = rule.matchers[0];

        if (to.type !== "literal" || to.field !== "to" || !to.value) continue;

        let set = rules.get(to.value);
        if (!set) {
            set = new Set<string>();
            rules.set(to.value, set);
        }

        for (const action of rule.actions)
            if (action.type === "forward" && action.value)
                for (const value of action.value) set.add(value);
    }
};

export const getRule = async (
    address: string,
): Promise<ReadonlySet<string>> => {
    loaded ??= load();
    await loaded;

    return rules.get(address) ?? addresses;
};
