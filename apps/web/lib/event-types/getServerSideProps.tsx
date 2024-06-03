import type { GetServerSidePropsContext } from "next";
import nookies from "nookies";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { WEBAPP_URL, KEYCLOAK_COOKIE_DOMAIN, KEYCLOAK_TOKEN_SECRET } from "@calcom/lib/constants";
import { symmetricEncrypt } from "@calcom/lib/crypto";

import { ssrInit } from "@server/lib/ssr";

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const ssr = await ssrInit(context);
  const session = await getServerSession({ req: context.req, res: context.res });

  const keycloak_cookie_domain = KEYCLOAK_COOKIE_DOMAIN || "";
  const keycloak_token_secret = KEYCLOAK_TOKEN_SECRET || "";
  const useSecureCookies = WEBAPP_URL?.startsWith("https://");

  if (session?.id_token) {
    const encoded_token = symmetricEncrypt(session.id_token, keycloak_token_secret);
    nookies.set(context, "keycloak_id_token", encoded_token, {
      domain: keycloak_cookie_domain,
      sameSite: useSecureCookies ? "none" : "lax",
      path: "/",
      secure: useSecureCookies,
      httpOnly: true,
    });
  }

  if (session?.access_token) {
    const encoded_token = symmetricEncrypt(session.access_token, keycloak_token_secret);
    nookies.set(context, "keycloak_access_token", encoded_token, {
      domain: keycloak_cookie_domain,
      sameSite: useSecureCookies ? "none" : "lax",
      path: "/",
      secure: useSecureCookies,
      httpOnly: true,
    });
  }

  if (session?.refresh_token) {
    const encoded_token = symmetricEncrypt(session.refresh_token, keycloak_token_secret);
    nookies.set(context, "keycloak_refresh_token", encoded_token, {
      domain: keycloak_cookie_domain,
      sameSite: useSecureCookies ? "none" : "lax",
      path: "/",
      secure: useSecureCookies,
      httpOnly: true,
    });
  }

  if (!session) {
    return {
      redirect: {
        permanent: false,
        destination: "/auth/login",
      },
    };
  }

  return { props: { trpcState: ssr.dehydrate() } };
};
