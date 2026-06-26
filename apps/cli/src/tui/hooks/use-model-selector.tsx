import {
	fetchZenuxsRecommendedModels,
	Llms,
	ProviderSettingsManager,
	refreshProviderModelsFromSource,
	resolveProviderConfig,
} from "@cline/core";
import type { ChoiceContext } from "@opentui-ui/dialog";
import type { DialogActions } from "@opentui-ui/dialog/react";
import { useCallback, useState } from "react";
import type { Config } from "../../utils/types";
import { withLoadingDialog } from "../components/dialogs/loading-dialog";
import { buildZenuxsModelEntries } from "../components/model-selector/zenuxs-model-picker";
import {
	BROWSE_ALL_ACTION,
	ZenuxsModelSelectorDialogContent,
} from "../components/model-selector/zenuxs-model-selector";
import {
	ModelIdInputContent,
	type ModelOption,
	ModelSelectorContent,
	type ThinkingLevel,
	ThinkingLevelContent,
	buildModelOptions,
} from "../components/model-selector/model-selector";

async function getProviderDisplayName(providerId: string): Promise<string> {
	const info = await Llms.getProvider(providerId);
	return info?.name ?? providerId;
}

async function refreshCurrentProviderModels(config: Config): Promise<void> {
	const manager = new ProviderSettingsManager();
	await refreshProviderModelsFromSource(manager, config.providerId).catch(
		() => {},
	);
	const resolved = await resolveProviderConfig(
		config.providerId,
		{
			loadLatestOnInit: true,
			loadPrivateOnAuth: true,
			failOnError: false,
		},
		manager.getProviderConfig(config.providerId, { includeKnownModels: false }),
	);
	if (resolved?.knownModels) {
		config.knownModels = resolved.knownModels;
	}
}

function clearReasoningConfig(config: Config): void {
	config.thinking = false;
	config.reasoningEffort = undefined;
}

function usesModelIdInput(providerId: string): boolean {
	return providerId === "openai-compatible";
}

// Wrapper component to manage dynamic knownModels state updates inside dialog.choice
function ModelSelectorDialogWrapper(
	props: ChoiceContext<string> & {
		currentModel: string;
		currentProviderId: string;
		providerSettingsManager: ProviderSettingsManager;
		initialKnownModels: Record<string, Llms.ModelInfo>;
		showCustomModelId?: boolean;
		dialog: DialogActions;
		config: Config;
	},
) {
	const [knownModels, setKnownModels] = useState(props.initialKnownModels);

	const handleRefresh = useCallback(async () => {
		try {
			await refreshCurrentProviderModels(props.config);
			setKnownModels({ ...(props.config.knownModels as Record<string, Llms.ModelInfo>) });
		} catch {}
	}, [props.config]);

	return (
		<ModelSelectorContent
			{...props}
			knownModels={knownModels}
			onRefresh={handleRefresh}
		/>
	);
}

export interface OpenModelSelectorOptions {
	onCancel?: () => Promise<void> | void;
}

export function useModelSelector(opts: {
	dialog: DialogActions;
	config: Config;
	termHeight: number;
	onModelChange: () => Promise<void>;
	refocusTextarea: () => void;
}) {
	const { dialog, config, termHeight, onModelChange, refocusTextarea } = opts;

	const openModelSelector = useCallback(
		async (options?: OpenModelSelectorOptions) => {
			const handleCancel = async () => {
				if (options?.onCancel) {
					await options.onCancel();
					return;
				}
				refocusTextarea();
			};

			const providerSettingsManager = new ProviderSettingsManager();
			let providerDisplayName = config.providerId;

			await withLoadingDialog(dialog, "Loading models...", async () => {
				await refreshCurrentProviderModels(config);
				providerDisplayName = await getProviderDisplayName(config.providerId);
			});

			let pickingModel = true;

			while (pickingModel) {
				if (usesModelIdInput(config.providerId)) {
					const modelId = await dialog.choice<string>({
						style: { maxHeight: termHeight - 2 },
						content: (ctx: ChoiceContext<string>) => (
							<ModelIdInputContent
								{...ctx}
								currentModel={config.modelId}
								currentProviderName={providerDisplayName}
							/>
						),
					});
					if (!modelId) {
						await handleCancel();
						return;
					}
					config.modelId = modelId;
					clearReasoningConfig(config);
					pickingModel = false;
					continue;
				}

				if (config.providerId === "cline") {
					const clineResult = await dialog.choice<string>({
						style: { maxHeight: termHeight - 2 },
						content: (ctx: ChoiceContext<string>) => (
							<ZenuxsModelSelectorDialogContent

							
								{...ctx}
								currentModel={config.modelId}
								currentProviderName={providerDisplayName}
								knownModels={config.knownModels as Record<string, unknown>}
								loadEntries={async () =>
									buildZenuxsModelEntries(await fetchZenuxsRecommendedModels())
								}
							/>
						),
					});
					if (!clineResult) {
						await handleCancel();
						return;
					}
					if (clineResult === BROWSE_ALL_ACTION) {
						const browseResult = await dialog.choice<string>({
							style: { maxHeight: termHeight - 2 },
							content: (ctx: ChoiceContext<string>) => (
								<ModelSelectorDialogWrapper
									{...ctx}
									currentModel={config.modelId}
									currentProviderId={config.providerId}
									providerSettingsManager={providerSettingsManager}
									initialKnownModels={config.knownModels as Record<string, Llms.ModelInfo>}
									showCustomModelId={config.providerId !== "cline-pass"}
									dialog={dialog}
									config={config}
								/>
							),
						});
						if (!browseResult) continue;
						config.modelId = browseResult;
						const modelOptions = buildModelOptions(
							config.knownModels as Record<string, Llms.ModelInfo>,
						);
						const browseModel = modelOptions.find(
							(m: ModelOption) => m.key === browseResult,
						);
						if (browseModel?.supportsReasoning) {
							const lvl: ThinkingLevel = config.reasoningEffort
								? (config.reasoningEffort as ThinkingLevel)
								: config.thinking
									? "medium"
									: "none";
							const pick = await dialog.choice<ThinkingLevel>({
								style: { maxHeight: termHeight - 2 },
								content: (ctx: ChoiceContext<ThinkingLevel>) => (
									<ThinkingLevelContent
										{...ctx}
										modelName={browseModel.name}
										currentLevel={lvl}
									/>
								),
							});
							if (pick !== undefined) {
								if (pick === "none") {
									config.thinking = false;
									config.reasoningEffort = undefined;
								} else {
									config.thinking = true;
									config.reasoningEffort = pick;
								}
							}
						}
						if (!browseModel?.supportsReasoning) {
							clearReasoningConfig(config);
						}
						pickingModel = false;
						continue;
					}

					config.modelId = clineResult;
					const modelOptions = buildModelOptions(
						config.knownModels as Record<string, Llms.ModelInfo>,
					);
					const selectedModel = modelOptions.find(
						(m: ModelOption) => m.key === clineResult,
					);
					if (selectedModel?.supportsReasoning) {
						const currentLevel: ThinkingLevel = config.reasoningEffort
							? (config.reasoningEffort as ThinkingLevel)
							: config.thinking
								? "medium"
								: "none";
						const thinkingLevel = await dialog.choice<ThinkingLevel>({
							style: { maxHeight: termHeight - 2 },
							content: (ctx: ChoiceContext<ThinkingLevel>) => (
								<ThinkingLevelContent
									{...ctx}
									modelName={selectedModel.name}
									currentLevel={currentLevel}
								/>
							),
						});
						if (thinkingLevel !== undefined) {
							if (thinkingLevel === "none") {
								config.thinking = false;
								config.reasoningEffort = undefined;
							} else {
								config.thinking = true;
								config.reasoningEffort = thinkingLevel;
							}
						}
					}
					if (!selectedModel?.supportsReasoning) {
						clearReasoningConfig(config);
					}
					pickingModel = false;
					continue;
				}

				const selectedKey = await dialog.choice<string>({
					style: { maxHeight: termHeight - 2 },
					content: (ctx: ChoiceContext<string>) => (
						<ModelSelectorDialogWrapper
							{...ctx}
							currentModel={config.modelId}
							currentProviderId={config.providerId}
							providerSettingsManager={providerSettingsManager}
							initialKnownModels={config.knownModels as Record<string, Llms.ModelInfo>}
							showCustomModelId={config.providerId !== "cline-pass"}
							dialog={dialog}
							config={config}
						/>
					),
				});
				if (!selectedKey) {
					await handleCancel();
					return;
				}

				config.modelId = selectedKey;

				const modelOptions = buildModelOptions(
					config.knownModels as Record<string, Llms.ModelInfo>,
				);
				const selectedModel = modelOptions.find(
					(m: ModelOption) => m.key === selectedKey,
				);
				if (!selectedModel?.supportsReasoning) {
					clearReasoningConfig(config);
					pickingModel = false;
					break;
				}

				const currentLevel: ThinkingLevel = config.reasoningEffort
					? (config.reasoningEffort as ThinkingLevel)
					: config.thinking
						? "medium"
						: "none";

				const thinkingLevel = await dialog.choice<ThinkingLevel>({
					style: { maxHeight: termHeight - 2 },
					content: (ctx: ChoiceContext<ThinkingLevel>) => (
						<ThinkingLevelContent
							{...ctx}
							modelName={selectedModel.name}
							currentLevel={currentLevel}
						/>
					),
				});

				if (thinkingLevel === undefined) {
					continue;
				}

				if (thinkingLevel === "none") {
					config.thinking = false;
					config.reasoningEffort = undefined;
				} else {
					config.thinking = true;
					config.reasoningEffort = thinkingLevel;
				}
				pickingModel = false;
			}

			await withLoadingDialog(dialog, "Applying model...", async () => {
				await onModelChange();
			});
			refocusTextarea();
		},
		[dialog, config, termHeight, onModelChange, refocusTextarea],
	);

	return openModelSelector;
}
