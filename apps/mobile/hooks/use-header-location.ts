import { useTranslation } from "react-i18next";

import { useProfileQuery } from "@/hooks/use-profile";
import { headerLocationDisplay } from "@/lib/profile/location";

export function useHeaderLocation(enabled = true) {
	const { t } = useTranslation();
	const profile = useProfileQuery(enabled);

	return headerLocationDisplay(profile.data, t("home.locationUnset"), t("home.noLocation"));
}
