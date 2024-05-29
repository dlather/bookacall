import type { GetServerSidePropsContext } from "next";
import nookies from "nookies";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";

import { ssrInit } from "@server/lib/ssr";

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const ssr = await ssrInit(context);
  const session = await getServerSession({ req: context.req, res: context.res });
  if (session?.id_token) {
    nookies.set(context, "keycloak-id_token", session.id_token, {
      path: "/",
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
