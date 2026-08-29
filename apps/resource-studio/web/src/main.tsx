import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App } from "./studio/App";
import "./index.css";

document.documentElement.classList.add("dark");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={180}>
      <App />
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  </React.StrictMode>
);
