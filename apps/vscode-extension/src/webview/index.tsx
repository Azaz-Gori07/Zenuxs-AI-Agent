import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExtensionStateProvider } from "./context/ExtensionStateContext.js";
import { App } from "./App.js";

const root = document.getElementById("root");
if (root) {
	createRoot(root).render(
		<StrictMode>
			<ExtensionStateProvider>
				<App />
			</ExtensionStateProvider>
		</StrictMode>,
	);
}
