import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { PillWidget } from "./components/PillWidget";
import "./App.css";

export default function App() {
  // Start polling. This runs once and lives for the app lifetime.
  useNetworkPoller(1000);

  return <PillWidget />;
}
