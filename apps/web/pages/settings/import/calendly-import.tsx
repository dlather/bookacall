import { CalendlyOAuthProvider } from "@onehash/calendly";
import { Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import OauthPopup from "react-oauth-popup";

import { getLayout } from "@calcom/features/settings/layouts/SettingsLayout";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button, Meta, SkeletonContainer, showToast } from "@calcom/ui";

import PageWrapper from "@components/PageWrapper";

const SkeletonLoader = ({ title, description }: { title: string; description: string }) => {
  return (
    <SkeletonContainer>
      <Meta title={title} description={description} borderInShellHeader={true} />
    </SkeletonContainer>
  );
};

//Component responsible for importing data from Calendly if user has already authorized Calendly
const ImportFromCalendlyButton = ({
  importFromCalendly,
  importing,
}: {
  importFromCalendly: () => Promise<void>;
  importing: boolean | undefined;
}) => {
  const { t } = useLocale();

  return (
    <Button color="secondary" StartIcon={Plus} onClick={importFromCalendly} loading={importing}>
      {t("import")}
    </Button>
  );
};

//Component responsible for authorizing Calendly on first time import
const AuthorizeCalendlyButton = ({
  authorizationUrl,
  onCode,
  onClose,
}: {
  authorizationUrl: string;
  onCode: (code: string, params: URLSearchParams) => void;
  onClose: () => void;
}) => {
  const { t } = useLocale();

  return (
    <OauthPopup url={authorizationUrl} onCode={onCode} onClose={onClose} height={400} width={600} title="">
      <Button color="secondary" StartIcon={Plus}>
        {t("import")}
      </Button>
    </OauthPopup>
  );
};

//Main view for Calendly import
const ConferencingLayout = () => {
  const { t } = useLocale();

  const [userId, setUserId] = useState<number>();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [importing, setImporting] = useState<boolean>(false);
  const [didAuthorize, setDidAuthorize] = useState<boolean>(false);

  const session = useSession();

  /**
   * Checks if the user has already authorized Calendly and sets the state accordingly
   * @param userId The user id of the current user
   */
  const checkIfAuthorized = async (userId: number) => {
    try {
      setLoading(true);
      if (!userId) return;
      const res = await fetch(`/api/import/calendly/auth?userId=${userId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("error", data);
        return;
      }
      const data = await res.json();
      setIsAuthorized(data.authorized);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  /**
   * Retrieves and stores the user's access token and refresh token from Calendly
   * @param code  Authorization Code is a temporary code that the client exchanges for an access token.
   */
  const retrieveUserCalendlyAccessToken = (code: string) => {
    console.log("Code received from Calendly");
    fetch("/api/import/calendly/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        userId,
      }),
    }).then(
      (res) => {
        if (res.ok) {
          setIsAuthorized(true);
          setDidAuthorize(true);
        }
      },
      (err) => {
        console.error("Error retrieving tokens", err);
      }
    );
  };

  //handles the authorization code returned from Calendly
  const onCode = (code: string, _params: URLSearchParams) => retrieveUserCalendlyAccessToken(code);
  const onClose = () => console.log("closed!");
  const calendlyOAuthProvider = new CalendlyOAuthProvider({
    clientId: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
    redirectUri: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI ?? "",
    oauthUrl: process.env.NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
  });

  //responsible for the api call to import data from Calendly
  const importFromCalendly = async () => {
    try {
      if (!isAuthorized || importing) return;
      setImporting(true);
      const uri = `/api/import/calendly?userId=${userId}`;
      const res = await fetch(uri, {
        headers: {
          "Content-Type": "application/json",
        },
        method: "GET",
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("error", data);
        return;
      }
      showToast("Data importing began in background", "success");
    } catch (e) {
      console.error("Error importing from Calendly", e);
    } finally {
      setImporting(false);
    }
  };

  //checks if the user had already authorized Calendly on first load
  useEffect(() => {
    if (!session || !session.data) return;
    session.data.user.id && setUserId(session.data.user.id);
    checkIfAuthorized(session.data.user.id);
  }, [session]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  useEffect(() => {
    if (didAuthorize) {
      importFromCalendly();
    }
  }, [didAuthorize]);

  return (
    <>
      {loading ? (
        <SkeletonLoader title="Calendly" description={t("import_data_instructions")} />
      ) : (
        <div className="bg-default w-full sm:mx-0 xl:mt-0">
          <Meta
            title="Calendly"
            description={t("import_data_instructions")}
            CTA={
              isAuthorized ? (
                <ImportFromCalendlyButton importFromCalendly={importFromCalendly} importing={importing} />
              ) : (
                <AuthorizeCalendlyButton
                  onClose={onClose}
                  onCode={onCode}
                  authorizationUrl={calendlyOAuthProvider.getAuthorizationUrl()}
                />
              )
            }
            borderInShellHeader={true}
          />
        </div>
      )}
    </>
  );
};

ConferencingLayout.getLayout = getLayout;
ConferencingLayout.PageWrapper = PageWrapper;

export default ConferencingLayout;
