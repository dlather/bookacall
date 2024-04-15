import { getServerSideProps as GSSUserPage } from "@pages/[user]";
import { getServerSideProps as GSSTeamPage } from "@pages/team/[slug]";
import type { GetServerSidePropsContext } from "next";

import { getSlugOrRequestedSlug } from "@calcom/features/oe/organizations/lib/orgDomains";
import prisma from "@calcom/prisma";

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const team = await prisma.team.findFirst({
    where: {
      slug: ctx.query.user as string,
      parentId: {
        not: null,
      },
      parent: getSlugOrRequestedSlug(ctx.query.orgSlug as string),
    },
    select: {
      id: true,
    },
  });
  if (team) {
    return GSSTeamPage({ ...ctx, query: { slug: ctx.query.user } });
  }
  return GSSUserPage({ ...ctx, query: { user: ctx.query.user, redirect: ctx.query.redirect } });
};
