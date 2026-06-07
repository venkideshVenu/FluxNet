import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { PillWidget } from "./components/PillWidget";
import { useWidgetSettings } from "./hooks/useWidgetSettings";
import "./pill.css";

export default function PillApp() {
  useNetworkPoller();
  useWidgetSettings("pill");

  return <PillWidget />;
}
