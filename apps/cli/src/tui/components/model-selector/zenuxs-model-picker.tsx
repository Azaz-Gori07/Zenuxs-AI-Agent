// @jsxImportSource @opentui/react

import {
	type ZenuxsRecommendedModel,
	type ZenuxsRecommendedModelsData,
	fetchZenuxsRecommendedModels,
} from "@cline/core";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import "opentui-spinner/react";
import { palette } from "../../palette";

export interface ZenuxsModelPickerItem {
	kind: "model";
	model: ZenuxsRecommendedModel;
	tier: "recommended" | "free";
}

export interface ZenuxsModelPickerBrowse {
	kind: "browse";
}

export type ZenuxsModelPickerEntry =
	| ZenuxsModelPickerItem
	| ZenuxsModelPickerBrowse;

function tagColor(tag: string): string {
	if (tag === "FREE") return palette.success;
	if (tag === "BEST") return "magenta";
	return "cyan";
}

function resolveDisplayName(
	modelId: string,
	knownModels?: Record<string, unknown>,
): string {
	if (knownModels) {
		const candidates = [modelId, modelId.split("/").pop()];
		for (const key of candidates) {
			if (!key) continue;
			const hit = knownModels[key] as { name?: string } | undefined;
			if (hit?.name) return hit.name;
		}
	}
	return modelId.includes("/")
		? (modelId.split("/").pop() ?? modelId)
		: modelId;
}

export function useZenuxsRecommendedModels() {
	const [data, setData] = useState<ZenuxsRecommendedModelsData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		fetchZenuxsRecommendedModels()
			.then((result) => {
				if (!cancelled) setData(result);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return { data, loading };
}

export function buildZenuxsModelEntries(
	data: ZenuxsRecommendedModelsData,
): ZenuxsModelPickerEntry[] {
	const entries: ZenuxsModelPickerEntry[] = [];
	for (const m of data.recommended) {
		entries.push({ kind: "model", model: m, tier: "recommended" });
	}
	for (const m of data.free) {
		entries.push({ kind: "model", model: m, tier: "free" });
	}
	entries.push({ kind: "browse" });
	return entries;
}

export function ZenuxsModelPicker(props: {
	entries: ZenuxsModelPickerEntry[];
	selected: number;
	loading?: boolean;
	knownModels?: Record<string, unknown>;
	currentModelId?: string;
}) {
	const { entries, selected, loading, knownModels, currentModelId } = props;

	if (loading) {
		return (
			<box flexDirection="row" gap={1} paddingX={1}>
				<spinner name="dots" color="gray" />
				<text fg="gray">Loading models...</text>
			</box>
		);
	}

	let lastTier: string | null = null;
	let isFirstHeader = true;
	const rows: ReactNode[] = [];

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		if (!entry) continue;
		const isSel = i === selected;

		if (entry.kind === "model") {
			if (entry.tier !== lastTier) {
				lastTier = entry.tier;
				const label = entry.tier === "recommended" ? "Recommended" : "Free";
				rows.push(
					<box
						key={`tier-${entry.tier}`}
						paddingX={1}
						marginTop={isFirstHeader ? 0 : 1}
					>
						<text fg="gray">{label}</text>
					</box>,
				);
				isFirstHeader = false;
			}

			const tags = entry.model.tags;
			const name = resolveDisplayName(entry.model.id, knownModels);
			const isCurrent = currentModelId === entry.model.id;
			rows.push(
				<box
					key={entry.model.id}
					paddingX={1}
					flexDirection="row"
					gap={1}
					backgroundColor={isSel ? palette.selection : undefined}
				>
					<text fg={isSel ? palette.textOnSelection : "gray"} flexShrink={0}>
						{isSel ? "\u276f" : " "}
					</text>
					<text fg={isSel ? palette.textOnSelection : undefined}>{name}</text>
					{tags.map((t) => (
						<text
							key={t}
							fg={isSel ? palette.textOnSelection : tagColor(t)}
							flexShrink={0}
						>
							{t}
						</text>
					))}
					{isCurrent && (
						<text fg={isSel ? palette.textOnSelection : "gray"} flexShrink={0}>
							(current)
						</text>
					)}
				</box>,
			);
		} else {
			rows.push(
				<box
					key="browse-all"
					paddingX={1}
					flexDirection="row"
					gap={1}
					backgroundColor={isSel ? palette.selection : undefined}
					marginTop={1}
				>
					<text fg={isSel ? palette.textOnSelection : "gray"} flexShrink={0}>
						{isSel ? "\u276f" : " "}
					</text>
					<text fg={isSel ? palette.textOnSelection : "gray"}>
						Browse all models...
					</text>
				</box>,
			);
		}
	}

	return <box flexDirection="column">{rows}</box>;
}
