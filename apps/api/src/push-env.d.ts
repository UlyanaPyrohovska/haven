// Push secrets (`wrangler secret put`), merged into the generated bindings; all optional so push stays off when unset.
interface CloudflareBindings {
	FCM_PROJECT_ID?: string;
	FCM_CLIENT_EMAIL?: string;
	FCM_PRIVATE_KEY?: string;
	APNS_KEY_ID?: string;
	APNS_TEAM_ID?: string;
	APNS_PRIVATE_KEY?: string;
	APNS_BUNDLE_ID?: string;
	APNS_SANDBOX?: string;
}
