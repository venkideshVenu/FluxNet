import { useNetworkPoller } from "@/hooks";
import { PillWidget } from "@/components";
import { useWidgetSettings } from "@/hooks";
import "@/pill.css";

export default function PillApp() {
  useNetworkPoller();
  useWidgetSettings("pill");

  return <PillWidget />;
}
