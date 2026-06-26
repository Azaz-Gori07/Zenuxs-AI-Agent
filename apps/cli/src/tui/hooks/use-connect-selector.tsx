// @jsxImportSource @opentui/react
import {
	refreshProviderModelsFromSource,
	ProviderSettingsManager,
	getProviderConfigFields,
	deleteLocalProvider,
} from "@cline/core";
import type { ChoiceContext } from "@opentui-ui/dialog";
import type { DialogActions } from "@opentui-ui/dialog/react";
import { useCallback } from "react";
import {
	ProviderManagerContent,
	ProviderConfigInputContent,
	OAuthLoginContent,
	CodexCliStatusContent,
	DisconnectActiveProviderConfirmContent,
} from "../components/dialogs/provider-picker";
import { withLoadingDialog } from "../components/dialogs/loading-dialog";
import { isOpenAICodexCliProvider } from "@cline/core";
import { isOAuthProvider } from "../../utils/provider-auth";
import type { Config } from "../../utils/types";

export function useConnectSelector(opts: {
	dialog: DialogActions;
	config: Config;
	termHeight: number;
	refocusTextarea: () => void;
	handleProviderChange: (providerId: string) => Promise<void>;
	showToast: (message: string, variant?: "info" | "success" | "error") => void;
}) {
	const {
		dialog,
		config,
		termHeight,
		refocusTextarea,
		handleProviderChange,
		showToast,
	} = opts;

	const editProvider = useCallback(
		async (providerId: string) => {
			const manager = new ProviderSettingsManager();
			let displayName = providerId;
			try {
				const info = await withLoadingDialog(
					dialog,
					"Loading provider info...",
					async () => {
						const res = await manager.getProviderConfig(providerId);
						return res;
					},
				);
				displayName = info?.providerId ?? providerId;
			} catch {}

			let saved: boolean | undefined;
			if (isOAuthProvider(providerId)) {
				saved = await dialog.choice<boolean>({
					style: { maxHeight: termHeight - 2 },
					closeOnEscape: false,
					content: (ctx: ChoiceContext<boolean>) => (
						<OAuthLoginContent
							{...ctx}
							providerId={providerId}
							providerName={displayName}
						/>
					),
				});
			} else if (isOpenAICodexCliProvider(providerId)) {
				saved = await dialog.choice<boolean>({
					style: { maxHeight: termHeight - 2 },
					closeOnEscape: false,
					content: (ctx: ChoiceContext<boolean>) => (
						<CodexCliStatusContent {...ctx} providerName={displayName} />
					),
				});
				if (saved) {
					const existingSettings = manager.getProviderSettings(providerId);
					manager.saveProviderSettings({
						...(existingSettings ?? {}),
						provider: providerId,
					});
				}
			} else {
				const { fields } = getProviderConfigFields(providerId);
				saved = await dialog.choice<boolean>({
					style: { maxHeight: termHeight - 2 },
					closeOnEscape: false,
					content: (ctx: ChoiceContext<boolean>) => (
						<ProviderConfigInputContent
							{...ctx}
							providerId={providerId}
							providerName={displayName}
							fields={fields}
							providerSettingsManager={manager}
						/>
					),
				});

				if (saved) {
					// Validate credentials by attempting to refresh models from source
					try {
						await withLoadingDialog(
							dialog,
							`Testing connection to ${providerId}...`,
							async () => {
								const res = await refreshProviderModelsFromSource(manager, providerId);
								if (!res.refreshed) {
									throw new Error("Unable to refresh models from source");
								}
							},
						);
					} catch (error) {
						// Validation failed! We must clean up settings and mark as not saved.
						const msg = error instanceof Error ? error.message : String(error);
						showToast(`Connection failed: ${msg}`, "error");

						const state = manager.read();
						if (state.providers[providerId]) {
							delete state.providers[providerId];
							if (state.lastUsedProvider === providerId) {
								delete state.lastUsedProvider;
							}
							manager.write(state);
						}
						saved = false;
					}
				}
			}

			if (saved) {
				showToast("Provider configuration saved successfully", "success");
				if (providerId === config.providerId) {
					await handleProviderChange(providerId);
				}
			}
		},
		[dialog, termHeight, config.providerId, handleProviderChange, showToast],
	);

	const disconnectProvider = useCallback(
		async (providerId: string) => {
			const manager = new ProviderSettingsManager();
			const isActiveProvider = (providerId === config.providerId);
			if (isActiveProvider) {
				const confirmDisconnect = await dialog.choice<boolean>({
					style: { maxHeight: termHeight - 2 },
					closeOnEscape: true,
					content: (ctx: ChoiceContext<boolean>) => (
						<DisconnectActiveProviderConfirmContent
							{...ctx}
							providerName={providerId}
						/>
					),
				});
				if (!confirmDisconnect) {
					return; // User cancelled
				}
			}

			try {
				await deleteLocalProvider(manager, { providerId });
				showToast(`Disconnected ${providerId}`, "success");
				if (isActiveProvider) {
					config.providerId = "";
					config.modelId = "";
					config.apiKey = "";
					config.baseUrl = "";
					config.thinking = false;
					config.reasoningEffort = undefined;
					await handleProviderChange("");
				}
			} catch (error) {
				const state = manager.read();
				if (state.providers[providerId]) {
					delete state.providers[providerId];
					if (state.lastUsedProvider === providerId) {
						delete state.lastUsedProvider;
					}
					manager.write(state);
				}
				showToast(`Disconnected ${providerId}`, "success");
				if (isActiveProvider) {
					config.providerId = "";
					config.modelId = "";
					config.apiKey = "";
					config.baseUrl = "";
					config.thinking = false;
					config.reasoningEffort = undefined;
					await handleProviderChange("");
				}
			}
		},
		[dialog, termHeight, config, handleProviderChange, showToast],
	);

	const testProvider = useCallback(
		async (providerId: string) => {
			const manager = new ProviderSettingsManager();
			const settings = manager.getProviderSettings(providerId);
			if (!settings) {
				showToast("Configure the provider before testing connection", "error");
				return;
			}

			try {
				await withLoadingDialog(
					dialog,
					`Testing connection to ${providerId}...`,
					async () => {
						const res = await refreshProviderModelsFromSource(manager, providerId);
						if (!res.refreshed) {
							throw new Error("Unable to refresh models from source");
						}
					},
				);
				showToast(
					`Connection successful! Loaded models for ${providerId}`,
					"success",
				);
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				showToast(`Connection failed: ${msg}`, "error");
			}
		},
		[dialog, showToast],
	);

	const openConnectSelector = useCallback(async () => {
		const manager = new ProviderSettingsManager();
		let selectedId: string | undefined;
		while (true) {
			selectedId = await dialog.choice<string>({
				size: "large",
				style: { maxHeight: termHeight - 2 },
				content: (ctx: ChoiceContext<string>) => (
					<ProviderManagerContent
						{...ctx}
						currentProviderId={config.providerId}
						providerSettingsManager={manager}
						onEdit={editProvider}
						onDisconnect={disconnectProvider}
						onTest={testProvider}
					/>
				),
			});

			if (selectedId) {
				const settings = manager.getProviderSettings(selectedId);
				if (!settings) {
					// Setup/reconnect flow: prompt for setup and validate credentials
					await editProvider(selectedId);
					const updatedSettings = manager.getProviderSettings(selectedId);
					if (updatedSettings) {
						await handleProviderChange(selectedId);
						break;
					}
					// If the user cancelled setup or validation failed, loop again to let them choose
				} else {
					await handleProviderChange(selectedId);
					break;
				}
			} else {
				// User escaped/dismissed the dialog.
				// If config.providerId is empty (because active provider was disconnected), we must not allow them to exit in an invalid state.
				if (!config.providerId) {
					showToast("Please select and configure a provider to continue", "error");
					continue;
				}
				break;
			}
		}
		refocusTextarea();
	}, [
		dialog,
		termHeight,
		config,
		editProvider,
		disconnectProvider,
		testProvider,
		handleProviderChange,
		refocusTextarea,
		showToast,
	]);

	return openConnectSelector;
}
