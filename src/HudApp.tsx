import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { GamingHud } from "./components/GamingHud";
import { useWidgetSettings } from "./hooks/useWidgetSettings";
import "./hud.css";

export default function HudApp() {
  useNetworkPoller();
  useWidgetSettings("hud");

  return <GamingHud />;
}
