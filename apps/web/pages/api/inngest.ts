import { handleCalendlyImportEvent } from "@pages/api/import/calendly";
import { Inngest } from "inngest";
import { serve } from "inngest/next";

import { INNGEST_ID } from "@calcom/lib/constants";

export const inngestClient = new Inngest({ id: INNGEST_ID });

const handleCalendlyImportFn = inngestClient.createFunction(
  { id: "import-from-calendly", retries: 4 },
  { event: "import-from-calendly" },
  async ({ event, step }) => {
    await handleCalendlyImportEvent(event.data.userCalendlyIntegrationProvider, event.data.user, step);
    return { message: `Import completed for userID :${event.data.user.id}` };
  }
);

// Create an API that serves zero functions
export default serve({
  client: inngestClient,
  functions: [handleCalendlyImportFn],
});
