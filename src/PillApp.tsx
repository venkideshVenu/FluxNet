import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { PillWidget } from "./components/PillWidget";
import { useWidgetSettings } from "./hooks/useWidgetSettings";
import { AppProviders } from "./AppProviders";
import "./pill.css";

export default function PillApp() {
  useNetworkPoller();
  useWidgetSettings("pill");

  return (
    <AppProviders>
      <PillWidget />
    </AppProviders>
  );
}