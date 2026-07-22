"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { desktopClient } from "@/lib/desktop-client";
import { cn } from "@/lib/utils";
import { PageFrame, PageHeader } from "../page-layout";

interface BackendSkill {
	id: string;
	name: string;
	description: string;
	filePath: string;
	enabled: boolean;
	source: string;
	instructions: string;
}

export function SkillsContent() {
	const [skills, setSkills] = useState<BackendSkill[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadSkills = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await desktopClient.invoke<BackendSkill[]>("list_skills");
			setSkills(data ?? []);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
			setSkills([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			void loadSkills();
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, [loadSkills]);

	const toggleSkill = async (id: string, enabled: boolean) => {
		setSkills((prev) =>
			prev.map((skill) =>
				skill.id === id ? { ...skill, enabled } : skill,
			),
		);
		try {
			await desktopClient.invoke("toggle_skill", { id, enabled });
		} catch {
			// Revert on failure
			setSkills((prev) =>
				prev.map((skill) =>
					skill.id === id ? { ...skill, enabled: !enabled } : skill,
				),
			);
		}
	};

	return (
		<PageFrame>
			<PageHeader
				description="Manage your installed skills and extend Zenuxs capabilities."
				title="Skills"
				actions={
					<>
						<Button
							variant="outline"
							size="sm"
							onClick={() => void loadSkills()}
							disabled={loading}
						>
							<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
						</Button>
						<Button size="sm" disabled>
							<Plus className="h-4 w-4" />
							Install Skill
						</Button>
					</>
				}
			/>

			{error && (
				<div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</div>
			)}

			{loading ? (
				<div className="rounded-lg border border-border px-5 py-8 text-center">
					<p className="text-sm text-muted-foreground">Loading skills...</p>
				</div>
			) : skills.length === 0 ? (
				<div className="rounded-lg border border-border px-5 py-8 text-center">
					<p className="text-sm text-muted-foreground">
						No skills found. Add skill markdown files to your skills/ directory or browse the marketplace.
					</p>
				</div>
			) : (
				<ScrollArea className="max-w-[46rem]">
					<div className="space-y-3 pr-4">
						{skills.map((skill) => (
							<div
								key={skill.id}
								className="rounded-lg border border-border px-5 py-4 transition-colors hover:bg-accent/20"
							>
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<h3 className="text-sm font-semibold text-foreground truncate">
												{skill.name}
											</h3>
											<span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground capitalize">
												{skill.source}
											</span>
										</div>
										{skill.description && (
											<p className="mt-1 text-sm text-muted-foreground line-clamp-2">
												{skill.description}
											</p>
										)}
										<p className="mt-1 text-xs text-muted-foreground/70 truncate font-mono">
											{skill.filePath}
										</p>
									</div>
									<Switch
										checked={skill.enabled}
										onCheckedChange={(checked) =>
											void toggleSkill(skill.id, checked)
										}
									/>
								</div>
							</div>
						))}
					</div>
				</ScrollArea>
			)}
		</PageFrame>
	);
}
