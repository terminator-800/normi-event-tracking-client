import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./index.css";
import App from "./App";

const queryClient = new QueryClient();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster
        position="top-center"
        containerStyle={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: "12px",
            border: "1px solid #d1d5db",
            padding: "12px 14px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#1f2937",
            background: "#ffffff",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.12)",
          },
          success: {
            iconTheme: {
              primary: "#07713c",
              secondary: "#ffffff",
            },
            style: {
              border: "1px solid #86efac",
              background: "#f0fdf4",
              color: "#166534",
            },
          },
          error: {
            iconTheme: {
              primary: "#dc2626",
              secondary: "#ffffff",
            },
            style: {
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
            },
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);
