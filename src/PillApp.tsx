import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { PillWidget } from "./components/PillWidget";
import "./App.css";

export default function PillApp() {
  useNetworkPoller();
  return <PillWidget />;
}
