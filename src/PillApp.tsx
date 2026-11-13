import { PillWidget } from "@/components";
import { useWidgetSettings, useSettingsSync, useNetworkPoller } from "@/hooks";
import { AppProviders } from "@/AppProviders";

export default function PillApp() {
  useNetworkPoller();
  useWidgetSettings("pill");
  useSettingsSync();

  return (
    <AppProviders>
      <PillWidget />
    </AppProviders>
  );
}
