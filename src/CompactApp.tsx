import { useNetworkPoller } from "@/hooks";
import { CompactWidget } from "@/components";
import { useWidgetSettings } from "@/hooks";
import "./compact.css";

export default function CompactApp() {
  useNetworkPoller();
  useWidgetSettings("compact");

  return <CompactWidget />;
}
