import { _generateMetadata } from "app/_utils";

import Page from "@calcom/features/oe/teams/pages/team-profile-view";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("profile"),
    (t) => t("profile_team_description")
  );

export default Page;
