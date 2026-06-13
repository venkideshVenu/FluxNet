import { PillWidget } from "@/components";
import { useWidgetSettings, useSettingsSync, useNetworkPoller } from "@/hooks";
import { AppProviders } from "@/AppProviders";
import "@/styles/pill.css";

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
