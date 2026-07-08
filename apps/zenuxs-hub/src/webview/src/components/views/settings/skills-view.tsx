"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageFrame, PageHeader } from "../page-layout";

interface InstalledSkill {
	id: string;
	name: string;
	description: string;
	version: string;
	installedAt: string;
	enabled: boolean;
}

export function SkillsContent() {
	const [skills, setSkills] = useState<InstalledSkill[]>([
		{
			id: "skill-1",
			name: "Code Review Assistant",
			description: "Automated code review and best practices checking",
			version: "1.2.0",
			installedAt: "2024-01-15",
			enabled: true,
		},
		{
			id: "skill-2",
			name: "Test Generator",
			description: "Generate unit tests for your code",
			version: "2.0.1",
			installedAt: "2024-02-20",
			enabled: true,
		},
	]);

	const [futureFeatures] = useState([
		{
			id: "create-skill",
			title: "Create Your Own Skill",
			description: "Build custom skills with our visual editor",
			status: "coming-soon",
		},
		{
			id: "worktree",
			title: "Worktree Integration",
			description: "Manage multiple worktrees with skill-aware context",
			status: "coming-soon",
		},
	]);

	const toggleSkill = (id: string) => {
		setSkills((prev) =>
			prev.map((skill) =>
				skill.id === id ? { ...skill, enabled: !skill.enabled } : skill,
			),
		);
	};

	const removeSkill = (id: string) => {
		setSkills((prev) => prev.filter((skill) => skill.id !== id));
	};

	return (
		<PageFrame>
			<PageHeader
				description="Manage your installed skills and extend Zenuxs capabilities."
				title="Skills"
				actions={
					<Button size="sm" disabled>
						<Plus className="h-4 w-4" />
						Install Skill
					</Button>
				}
			/>

			{skills.length === 0 ? (
				<div className="rounded-lg border border-border px-5 py-8 text-center">
					<p className="text-sm text-muted-foreground">
						No skills installed yet. Browse the marketplace to find skills.
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{skills.map((skill) => (
						<div
							key={skill.id}
							className="rounded-lg border border-border px-5 py-4 transition-colors hover:bg-accent/20"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<h3 className="text-sm font-semibold text-foreground">
											{skill.name}
										</h3>
										<span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
											v{skill.version}
										</span>
									</div>
									<p className="mt-1 text-sm text-muted-foreground">
										{skill.description}
									</p>
									<p className="mt-1 text-xs text-muted-foreground/70">
										Installed on {skill.installedAt}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => removeSkill(skill.id)}
									>
										Remove
									</Button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			<div className="mt-8">
				<h3 className="mb-4 text-lg font-semibold text-foreground">
					Coming Soon
				</h3>
				<div className="flex flex-col gap-3">
					{futureFeatures.map((feature) => (
						<div
							key={feature.id}
							className="rounded-lg border border-dashed border-border px-5 py-4 opacity-60"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="flex-1">
									<h3 className="text-sm font-semibold text-foreground">
										{feature.title}
									</h3>
									<p className="mt-1 text-sm text-muted-foreground">
										{feature.description}
									</p>
								</div>
								<span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
									Coming Soon
								</span>
							</div>
						</div>
					))}
				</div>
			</div>
		</PageFrame>
	);
}