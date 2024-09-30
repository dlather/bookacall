import Image from "next/image";
import Link from "next/link";

import type { TDependencyData } from "@calcom/app-store/_appRegistry";
import { InstallAppButtonWithoutPlanCheck } from "@calcom/app-store/components";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import type { App } from "@calcom/types/App";
import { Badge, Button, Icon } from "@calcom/ui";

interface IAppConnectionItem {
  title: string;
  description?: string;
  logo: string;
  type: App["type"];
  installed?: boolean;
  isDefault?: boolean;
  defaultInstall?: boolean;
  slug?: string;
  dependencyData?: TDependencyData;
}

const AppConnectionItem = (props: IAppConnectionItem) => {
  const { title, logo, type, installed, isDefault, defaultInstall, slug } = props;
  const { t } = useLocale();
  const setDefaultConferencingApp = trpc.viewer.appsRouter.setDefaultConferencingApp.useMutation();
  const dependency = props.dependencyData?.find((data) => !data.installed);
  return (
    <div className="flex flex-row items-center justify-between p-5">
      <div className="flex items-center space-x-3">
        <Image src={logo} alt={title} width={32} height={32} />
        <p className="text-sm font-bold">{title}</p>
        {isDefault && <Badge variant="green">{t("default")}</Badge>}
      </div>
      <InstallAppButtonWithoutPlanCheck
        type={type}
        options={{
          onSuccess: () => {
            if (defaultInstall && slug) {
              setDefaultConferencingApp.mutate({ slug });
            }
          },
        }}
        render={(buttonProps) => (
          <Button
            {...buttonProps}
            color="secondary"
            disabled={installed || !!dependency}
            type="button"
            loading={buttonProps?.isPending}
            tooltip={
              dependency ? (
                <div className="items-start space-x-2.5">
                  <div className="flex items-start">
                    <div>
                      <Icon name="circle-alert" className="mr-2 mt-1 font-semibold" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold">
                        {t("this_app_requires_connected_account", {
                          appName: title,
                          dependencyName: dependency.name,
                        })}
                      </span>

                      <div>
                        <div>
                          <>
                            <Link
                              href={`${WEBAPP_URL}/getting-started/connected-calendar`}
                              className="flex items-center text-xs underline">
                              <span className="mr-1">
                                {t("connect_app", { dependencyName: dependency.name })}
                              </span>
                              <Icon name="arrow-right" className="inline-block h-3 w-3" />
                            </Link>
                          </>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : undefined
            }
            onClick={(event) => {
              // Save cookie key to return url step
              document.cookie = `return_to=${window.location.href};path=/;max-age=3600;SameSite=Lax`;
              buttonProps && buttonProps.onClick && buttonProps?.onClick(event);
            }}>
            {installed ? t("installed") : t("connect")}
          </Button>
        )}
      />
    </div>
  );
};

export { AppConnectionItem };
