import { useNetworkPoller, useSettingsSync, useWidgetSettings } from "@/hooks";
import { CompactWidget } from "@/components";
import { AppProviders } from "@/AppProviders";
import "@/styles/compact.css";

export default function CompactApp() {
  useNetworkPoller();
  useWidgetSettings("compact");
  useSettingsSync();

  return (
    <AppProviders>
      <CompactWidget />
    </AppProviders>
  );
}
