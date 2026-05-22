export const FORWARDING_EMAIL_ADDRESSES = [
    "joaoapereira21@hotmail.com",
    "jonny4547.3@gmail.com",
];
export const FORWARDING_DOMAIN = "toino.pt";
export const FORWARDING_PATTERN = new RegExp(`^.+@${FORWARDING_DOMAIN}$`);

export const SENDING_DOMAIN = "send.toino.pt";
export const SENDING_PATTERN = new RegExp(
    `^(?<from>[^%]+)\\+(?<to>[^%]+%[^%]+)@${SENDING_DOMAIN}$`,
);

export const HEADERS_BLACKLIST_PATTERN =
    /^(?:ARC-.*|Bcc|Cc|CFBL-Address|CFBL-Feedback-ID|Content-Transfer-Encoding|Content-Type|Date|DKIM-Signature|Feedback-ID|From|Message-ID|MIME-Version|Received|Reply-To|Return-Path|Subject|TLS-Report-Domain|TLS-Report-Submitter|TLS-Required|To)$/i;
export const HEADERS_WHITELIST_PATTERN =
    /^(?:Archived-At|Auto-Submitted|Comments|Content-Language|Importance|In-Reply-To|Keywords|List-Archive|List-Help|List-Id|List-Owner|List-Post|List-Subscribe|List-Unsubscribe-Post|List-Unsubscribe|Organization|Precedence|References|Require-Recipient-Valid-Since|Sensitivity|X-[A-Za-z0-9\-_]+)$/i;
