import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { PillWidget } from "./components/PillWidget";
import { useWidgetSettings } from "./hooks/useWidgetSettings";
import { useSettingsSync } from "./hooks";
import { AppProviders } from "./AppProviders";
import "./styles/pill.css";

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
