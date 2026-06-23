// @jsxImportSource @opentui/react
import { Llms, ProviderSettingsManager } from "@cline/core";
import type { ChoiceContext } from "@opentui-ui/dialog";
import { useDialogKeyboard } from "@opentui-ui/dialog/react";
import { useMemo, useState } from "react";
import { palette } from "../../palette";

export interface ModelOption {
	key: string;
	name: string;
	maxInputTokens?: number;
	family?: string;
	supportsReasoning: boolean;
}

const MAX_VISIBLE = 10;

function normalize(s: string): string {
	return s.replace(/[^a-z0-9.]/g, "");
}

function fuzzyMatch(text: string, query: string): boolean {
	let qi = 0;
	for (let i = 0; i < text.length && qi < query.length; i++) {
		if (text[i] === query[qi]) qi++;
	}
	return qi === query.length;
}

function fuzzyScore(model: ModelOption, query: string): number {
	const name = model.name.toLowerCase();
	const key = model.key.toLowerCase();
	const nName = normalize(name);
	const nKey = normalize(key);
	const nQuery = normalize(query);
	if (nName === nQuery || nKey === nQuery) return 100;
	if (nName.startsWith(nQuery)) return 90;
	if (nKey.startsWith(nQuery)) return 85;
	if (nName.includes(nQuery)) return 70;
	if (nKey.includes(nQuery)) return 65;
	const family = model.family?.toLowerCase();
	if (family && normalize(family).includes(nQuery)) return 50;
	if (fuzzyMatch(nName, nQuery)) return 30;
	if (fuzzyMatch(nKey, nQuery)) return 25;
	return 0;
}

function formatTokenCount(tokens: number): string {
	if (tokens >= 1_000_000)
		return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
	if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
	return String(tokens);
}

// -- Model selector dialog content --

export function ModelIdInputContent(
	props: ChoiceContext<string> & {
		currentModel: string;
		currentProviderName: string;
	},
) {
	const { resolve, dismiss, dialogId, currentModel, currentProviderName } =
		props;
	const [modelId, setModelId] = useState(currentModel);
	const [error, setError] = useState("");

	const submit = () => {
		const trimmed = modelId.trim();
		if (!trimmed) {
			setError("Enter a model ID");
			return;
		}
		resolve(trimmed);
	};

	useDialogKeyboard((key) => {
		if (key.name === "escape") {
			dismiss();
			return;
		}
		if (key.name === "return" || key.name === "enter") {
			submit();
		}
	}, dialogId);

	return (
		<box flexDirection="column" gap={1}>
			<text>Set Model ID</text>

			<box flexDirection="row" gap={1}>
				<text fg="gray">Provider:</text>
				<text fg="white">{currentProviderName}</text>
			</box>

			<box flexDirection="column" gap={0}>
				<text fg="gray">Model ID</text>
				<box
					border
					borderStyle="rounded"
					borderColor={error ? "red" : palette.act}
					paddingX={1}
				>
					<input
						value={modelId}
						onInput={(value: string) => {
							setModelId(value);
							setError("");
						}}
						placeholder="provider/model"
						flexGrow={1}
						focused
					/>
				</box>
				{error && <text fg="red">{error}</text>}
			</box>

			<text fg="gray">Enter to save, Esc to close</text>
		</box>
	);
}

export function ModelSelectorContent(
	props: ChoiceContext<string> & {
		currentModel: string;
		currentProviderId: string;
		providerSettingsManager: ProviderSettingsManager;
		knownModels: Record<string, Llms.ModelInfo>;
		showCustomModelId?: boolean;
		onRefresh: () => Promise<void> | void;
	},
) {
	const {
		resolve,
		dismiss,
		dialogId,
		currentModel,
		currentProviderId,
		providerSettingsManager,
		knownModels,
		showCustomModelId = true,
		onRefresh,
	} = props;
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState(0);
	const [isSearchFocused, setIsSearchFocused] = useState(false);
	const [isCreatingCustomModel, setIsCreatingCustomModel] = useState(false);
	const [customModelId, setCustomModelId] = useState("");
	const [customModelError, setCustomModelError] = useState("");

	const providerName = useMemo(() => {
		const collection = Llms.getProviderCollectionSync(currentProviderId);
		return collection?.provider?.name ?? currentProviderId;
	}, [currentProviderId]);

	const recommendedIds = useMemo(() => {
		const collection = Llms.getProviderCollectionSync(currentProviderId);
		return collection ? Object.keys(collection.models) : [];
	}, [currentProviderId]);

	const [favorites, setFavorites] = useState<string[]>(() => {
		const settings = providerSettingsManager.read();
		return settings.providers[currentProviderId]?.favorites ?? [];
	});

	const [recentlyUsed] = useState<string[]>(() => {
		const settings = providerSettingsManager.read();
		return settings.providers[currentProviderId]?.recentlyUsed ?? [];
	});

	const baseModels = useMemo(() => {
		return buildModelOptions(knownModels);
	}, [knownModels]);

	const sortedModels = useMemo(() => {
		const models = [...baseModels];
		const getScore = (key: string) => {
			if (favorites.includes(key)) return 0;
			if (recommendedIds.includes(key)) return 1;
			const recentIdx = recentlyUsed.indexOf(key);
			if (recentIdx >= 0) return 2;
			return 3;
		};
		models.sort((a, b) => {
			const scoreA = getScore(a.key);
			const scoreB = getScore(b.key);
			if (scoreA !== scoreB) {
				return scoreA - scoreB;
			}
			if (scoreA === 2) {
				return recentlyUsed.indexOf(a.key) - recentlyUsed.indexOf(b.key);
			}
			return a.name.localeCompare(b.name);
		});
		return models;
	}, [baseModels, favorites, recommendedIds, recentlyUsed]);

	const filtered = useMemo(() => {
		if (!search) return sortedModels;
		const q = search.toLowerCase();
		const scored = sortedModels
			.map((m) => ({ model: m, score: fuzzyScore(m, q) }))
			.filter((r) => r.score > 0);
		scored.sort((a, b) => b.score - a.score);
		return scored.map((r) => r.model);
	}, [sortedModels, search]);

	const optionCount = filtered.length + (showCustomModelId ? 1 : 0);
	const safeSelected = Math.min(selected, Math.max(0, optionCount - 1));

	useDialogKeyboard((key) => {
		if (key.name === "escape") {
			if (isCreatingCustomModel) {
				setIsCreatingCustomModel(false);
				setCustomModelError("");
				return;
			}
			if (isSearchFocused) {
				setIsSearchFocused(false);
				return;
			}
			dismiss();
			return;
		}

		if (isCreatingCustomModel) return;

		if (isSearchFocused) {
			if (key.name === "return" || key.name === "enter") {
				setIsSearchFocused(false);
			}
			return;
		}

		if (key.name === "f") {
			setIsSearchFocused(true);
			return;
		}

		if (key.name === "r") {
			onRefresh();
			return;
		}

		if (key.name === "space" || key.name === "a") {
			const model = filtered[safeSelected];
			if (model) {
				const nextFavs = providerSettingsManager.toggleFavorite(currentProviderId, model.key).providers[currentProviderId]?.favorites ?? [];
				setFavorites(nextFavs);
			}
			return;
		}

		if (key.name === "return" || key.name === "enter") {
			const model = filtered[safeSelected];
			if (model) {
				providerSettingsManager.addRecentlyUsed(currentProviderId, model.key);
				resolve(model.key);
				return;
			}
			if (showCustomModelId && safeSelected === filtered.length) {
				setIsCreatingCustomModel(true);
				setCustomModelId("");
				setCustomModelError("");
			}
			return;
		}

		if (key.name === "up" || (key.ctrl && key.name === "p")) {
			setSelected((s) =>
				optionCount === 0 ? 0 : s <= 0 ? optionCount - 1 : s - 1,
			);
			return;
		}

		if (key.name === "down" || (key.ctrl && key.name === "n")) {
			setSelected((s) =>
				optionCount === 0 ? 0 : s >= optionCount - 1 ? 0 : s + 1,
			);
			return;
		}
	}, dialogId);

	if (isCreatingCustomModel) {
		return (
			<box flexDirection="column" gap={1}>
				<text>Create custom model ID</text>
				<box flexDirection="row" gap={1}>
					<text fg="gray">Provider:</text>
					<text fg="white">{providerName}</text>
				</box>

				<box flexDirection="column" gap={0}>
					<text fg="gray">Model ID</text>
					<box
						border
						borderStyle="rounded"
						borderColor={customModelError ? "red" : "gray"}
						paddingX={1}
					>
						<input
							value={customModelId}
							onInput={(v: string) => {
								setCustomModelId(v);
								setCustomModelError("");
							}}
							onSubmit={() => {
								const modelId = customModelId.trim();
								if (!modelId) {
									setCustomModelError("Enter a model ID");
									return;
								}
								providerSettingsManager.addRecentlyUsed(currentProviderId, modelId);
								resolve(modelId);
							}}
							placeholder=""
							flexGrow={1}
							focused
						/>
					</box>
					{customModelError && <text fg="red">{customModelError}</text>}
				</box>

				<text fg="gray">
					Enter to create, Esc to go back to model selection
				</text>
			</box>
		);
	}

	return (
		<box flexDirection="column" gap={1}>
			<text>Select Model</text>
			<box flexDirection="row" gap={1}>
				<text fg="gray">Provider:</text>
				<text fg="cyan">{providerName}</text>
			</box>

			<box border borderStyle="rounded" borderColor={isSearchFocused ? palette.act : "gray"} paddingX={1}>
				<input
					onInput={(v: string) => {
						setSearch(v);
						setSelected(0);
					}}
					placeholder="Search models..."
					flexGrow={1}
					focused={isSearchFocused}
				/>
			</box>

			<ModelList
				items={filtered}
				selected={safeSelected}
				currentModel={currentModel}
				favorites={favorites}
				providerName={providerName}
				onSelect={(key) => {
					providerSettingsManager.addRecentlyUsed(currentProviderId, key);
					resolve(key);
				}}
				showCustomModelId={showCustomModelId}
				onCreateCustomModel={() => {
					setIsCreatingCustomModel(true);
					setCustomModelId("");
					setCustomModelError("");
				}}
			/>

			<text fg="gray">
				Type to search | F focus filter | Space/A favorite | R refresh | Esc close
			</text>
		</box>
	);
}

// -- Thinking level dialog content --

export type ThinkingLevel = "none" | "low" | "medium" | "high" | "xhigh";

const THINKING_LEVELS: { value: ThinkingLevel; label: string; desc: string }[] =
	[
		{ value: "none", label: "Off", desc: "No extended thinking" },
		{ value: "low", label: "Low", desc: "Minimal reasoning" },
		{ value: "medium", label: "Medium", desc: "Balanced reasoning" },
		{ value: "high", label: "High", desc: "Deep reasoning" },
		{ value: "xhigh", label: "Extra High", desc: "Maximum reasoning" },
	];

export function ThinkingLevelContent(
	props: ChoiceContext<ThinkingLevel> & {
		modelName: string;
		currentLevel: ThinkingLevel;
	},
) {
	const { resolve, dismiss, dialogId, modelName, currentLevel } = props;
	const [selected, setSelected] = useState(() => {
		const idx = THINKING_LEVELS.findIndex((l) => l.value === currentLevel);
		return idx >= 0 ? idx : 0;
	});

	useDialogKeyboard((key) => {
		if (key.name === "escape") {
			dismiss();
			return;
		}
		if (key.name === "return" || key.name === "enter") {
			const level = THINKING_LEVELS[selected];
			if (level) resolve(level.value);
			return;
		}
		if (key.name === "up" || (key.ctrl && key.name === "p")) {
			setSelected((s) => (s <= 0 ? THINKING_LEVELS.length - 1 : s - 1));
			return;
		}
		if (key.name === "down" || (key.ctrl && key.name === "n")) {
			setSelected((s) => (s >= THINKING_LEVELS.length - 1 ? 0 : s + 1));
			return;
		}
	}, dialogId);

	return (
		<box flexDirection="column" gap={1}>
			<text>Thinking Level for {modelName}</text>

			<box flexDirection="column">
				{THINKING_LEVELS.map((level, i) => (
					<box
						key={level.value}
						paddingX={1}
						flexDirection="row"
						gap={1}
						justifyContent="space-between"
						backgroundColor={i === selected ? palette.selection : undefined}
						onMouseDown={() => resolve(level.value)}
					>
						<box flexDirection="row" gap={1} flexShrink={0}>
							<text
								fg={i === selected ? palette.textOnSelection : "gray"}
								flexShrink={0}
							>
								{i === selected ? "\u276f" : " "}
							</text>
							<text fg={i === selected ? palette.textOnSelection : undefined}>
								{level.label}
							</text>
						</box>
						<box flexDirection="row" gap={1} flexShrink={1}>
							<text fg={i === selected ? palette.textOnSelection : "gray"}>
								{level.desc}
							</text>
							{level.value === currentLevel && (
								<text
									fg={
										i === selected ? palette.textOnSelection : palette.success
									}
									flexShrink={0}
								>
									(current)
								</text>
							)}
						</box>
					</box>
				))}
			</box>

			<text fg="gray">↑/↓ navigate, Enter to select, Esc to go back</text>
		</box>
	);
}

// -- Windowed list --

function ModelList(props: {
	items: ModelOption[];
	selected: number;
	currentModel: string;
	favorites: string[];
	providerName: string;
	onSelect: (key: string) => void;
	showCustomModelId: boolean;
	onCreateCustomModel: () => void;
}) {
	const {
		items,
		selected,
		currentModel,
		favorites,
		providerName,
		onSelect,
		showCustomModelId,
		onCreateCustomModel,
	} = props;
	const rows: ({ type: "model"; model: ModelOption } | { type: "custom" })[] = [
		...items.map((model) => ({ type: "model" as const, model })),
		...(showCustomModelId ? ([{ type: "custom" as const }] as const) : []),
	];

	if (rows.length <= MAX_VISIBLE) {
		return (
			<box flexDirection="column">
				{rows.map((row, i) =>
					row.type === "model" ? (
						<ModelRow
							key={row.model.key}
							model={row.model}
							isSelected={i === selected}
							isCurrent={row.model.key === currentModel}
							isFavorite={favorites.includes(row.model.key)}
							providerName={providerName}
							onSelect={onSelect}
						/>
					) : (
						<CreateCustomModelRow
							key="create-custom-model"
							isSelected={i === selected}
							onSelect={onCreateCustomModel}
						/>
					),
				)}
			</box>
		);
	}

	const halfWindow = Math.floor(MAX_VISIBLE / 2);
	let start = Math.max(0, selected - halfWindow);
	if (start + MAX_VISIBLE > rows.length) {
		start = rows.length - MAX_VISIBLE;
	}

	const showAbove = start > 0;
	const showBelow = start + MAX_VISIBLE < rows.length;

	const itemSlots = MAX_VISIBLE - (showAbove ? 1 : 0) - (showBelow ? 1 : 0);
	const itemStart = showAbove ? start + 1 : start;
	const visible = rows.slice(itemStart, itemStart + itemSlots);

	const aboveCount = itemStart;
	const belowCount = rows.length - (itemStart + itemSlots);

	return (
		<box flexDirection="column">
			{showAbove && (
				<box paddingX={1} justifyContent="center">
					<text fg="gray">
						{"\u25b2"} {aboveCount} more
					</text>
				</box>
			)}
			{visible.map((row, i) =>
				row.type === "model" ? (
					<ModelRow
						key={row.model.key}
						model={row.model}
						isSelected={itemStart + i === selected}
						isCurrent={row.model.key === currentModel}
						isFavorite={favorites.includes(row.model.key)}
						providerName={providerName}
						onSelect={onSelect}
					/>
				) : (
					<CreateCustomModelRow
						key="create-custom-model"
						isSelected={itemStart + i === selected}
						onSelect={onCreateCustomModel}
					/>
				),
			)}
			{showBelow && (
				<box paddingX={1} justifyContent="center">
					<text fg="gray">
						{"\u25bc"} {belowCount} more
					</text>
				</box>
			)}
		</box>
	);
}

function CreateCustomModelRow(props: {
	isSelected: boolean;
	onSelect: () => void;
}) {
	const { isSelected, onSelect } = props;
	const bg = isSelected ? palette.selection : undefined;
	return (
		<box
			paddingX={1}
			flexDirection="row"
			gap={1}
			backgroundColor={bg}
			onMouseDown={onSelect}
			overflow="hidden"
			height={1}
		>
			<text fg={isSelected ? palette.textOnSelection : "gray"} flexShrink={0}>
				{isSelected ? "\u276f" : " "}
			</text>
			<text fg={isSelected ? palette.textOnSelection : undefined}>
				Create custom model ID
			</text>
			<text fg={isSelected ? palette.textOnSelection : "gray"} flexShrink={0}>
				manual entry
			</text>
		</box>
	);
}

function ModelRow(props: {
	model: ModelOption;
	isSelected: boolean;
	isCurrent: boolean;
	isFavorite: boolean;
	providerName: string;
	onSelect: (key: string) => void;
}) {
	const { model, isSelected, isCurrent, isFavorite, providerName, onSelect } = props;
	const bg = isSelected ? palette.selection : undefined;
	const favStar = isFavorite ? "★ " : "  ";
	return (
		<box
			paddingX={1}
			flexDirection="row"
			gap={1}
			backgroundColor={bg}
			onMouseDown={() => onSelect(model.key)}
			overflow="hidden"
			height={1}
		>
			<text fg={isSelected ? palette.textOnSelection : "gray"} flexShrink={0}>
				{isSelected ? "\u276f" : " "}
			</text>
			<text fg={isFavorite ? "yellow" : (isSelected ? palette.textOnSelection : undefined)} flexShrink={0}>
				{favStar}
			</text>
			<text fg={isSelected ? palette.textOnSelection : undefined} flexGrow={1}>
				{`[${providerName}] ${model.name}`}
			</text>
			{model.maxInputTokens && (
				<text fg={isSelected ? palette.textOnSelection : "gray"} flexShrink={0}>
					{formatTokenCount(model.maxInputTokens)}
				</text>
			)}
			{isCurrent && (
				<text
					fg={isSelected ? palette.textOnSelection : palette.success}
					flexShrink={0}
				>
					(current)
				</text>
			)}
		</box>
	);
}

// -- Build model options from catalog --

export function buildModelOptions(
	knownModels?: Record<string, Llms.ModelInfo>,
): ModelOption[] {
	if (!knownModels) return [];
	return Object.entries(knownModels)
		.map(([key, info]) => ({
			key,
			name: info.name ?? key,
			maxInputTokens: info.maxInputTokens ?? info.contextWindow,
			family: info.family,
			supportsReasoning: info.capabilities?.includes("reasoning") ?? false,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}
