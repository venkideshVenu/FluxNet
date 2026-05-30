import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { GamingHud } from "./components/GamingHud";
import "./hud.css";

export default function HudApp() {
  useNetworkPoller();
  return <GamingHud />;
}