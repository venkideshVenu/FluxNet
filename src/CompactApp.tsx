import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { CompactWidget } from "./components/CompactWidget";
import { useWidgetSettings } from "./hooks/useWidgetSettings";
import { AppProviders } from "./AppProviders";
import "./compact.css";

export default function CompactApp() {
  useNetworkPoller();
  useWidgetSettings("compact");

  return (
    <AppProviders>
      <CompactWidget />
    </AppProviders>
  );
}
