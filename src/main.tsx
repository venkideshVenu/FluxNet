import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import PillApp from "./PillApp";
import DashboardApp from "./DashboardApp";
import "./index.css";

async function boot() {
  const label = getCurrentWindow().label;
  const Root = label === "pill" ? PillApp : DashboardApp;

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
}

boot();
