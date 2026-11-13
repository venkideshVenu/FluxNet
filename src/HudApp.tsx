import { useNetworkPoller, useSettingsSync, useWidgetSettings } from "@/hooks";
import { AppProviders } from "@/AppProviders";
import { GamingHud } from "@/components";

export default function HudApp() {
  useNetworkPoller();
  useWidgetSettings("hud");
  useSettingsSync();

  return (
    <AppProviders>
      <GamingHud />
    </AppProviders>
  );
}
