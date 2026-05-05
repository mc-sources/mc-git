import "./migrations/0001-tsgit-to-mcgit";
import React from "react";
import ReactDOM from "react-dom/client";
import "./App.css";
import "./i18n";
import App from "./App";

document.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
