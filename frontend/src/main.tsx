import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@/lib/api-client";
import App from "./App";
import "./index.css";

setAuthTokenGetter(() => {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
});

createRoot(document.getElementById("root")!).render(<App />);
