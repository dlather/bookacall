import jackson from "@calcom/features/ee/sso/lib/jackson";
import {
  canAccess,
  oidcPath,
  samlProductID,
  samlTenantID,
  tenantPrefix,
} from "@calcom/features/ee/sso/lib/saml";

import { TRPCError } from "@trpc/server";

import type { TrpcSessionUser } from "../../../trpc";
import type { TGetInputSchema } from "./get.schema";

type GetOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TGetInputSchema;
};

export const getHandler = async ({ ctx, input }: GetOptions) => {
  const { userId } = input;
  const { message, access } = await canAccess(ctx.user);

  if (!access) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message,
    });
  }

  const { connectionController, samlSPConfig } = await jackson();

  // Retrieve the SP SAML Config
  const SPConfig = await samlSPConfig.get();

  try {
    const connections = await connectionController.getConnections({
      tenant: userId ? tenantPrefix + userId : samlTenantID,
      product: samlProductID,
    });

    if (connections.length === 0) {
      return null;
    }

    const type = "idpMetadata" in connections[0] ? "saml" : "oidc";

    return {
      ...connections[0],
      type,
      acsUrl: type === "saml" ? SPConfig.acsUrl : null,
      entityId: type === "saml" ? SPConfig.entityId : null,
      callbackUrl: type === "oidc" ? `${process.env.NEXT_PUBLIC_WEBAPP_URL}${oidcPath}` : null,
    };
  } catch (err) {
    console.error("Error getting SSO connection", err);
    throw new TRPCError({ code: "BAD_REQUEST", message: "Fetching SSO connection failed." });
  }
};
