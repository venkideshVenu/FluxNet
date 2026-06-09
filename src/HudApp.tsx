import { useNetworkPoller } from "@/hooks";
import { GamingHud } from "@/components";
import { useWidgetSettings } from "@/hooks";
import "./hud.css";

export default function HudApp() {
  useNetworkPoller();
  useWidgetSettings("hud");

  return <GamingHud />;
}
