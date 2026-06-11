import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { GamingHud } from "./components/GamingHud";
import { useWidgetSettings } from "./hooks/useWidgetSettings";
import { useSettingsSync } from "./hooks";
import { AppProviders } from "./AppProviders";
import "./styles/hud.css";

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
