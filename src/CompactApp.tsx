import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { CompactWidget } from "./components/CompactWidget";
import { useWidgetSettings } from "./hooks/useWidgetSettings";
import { useSettingsSync } from "./hooks";
import { AppProviders } from "./AppProviders";
import "./styles/compact.css";

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
