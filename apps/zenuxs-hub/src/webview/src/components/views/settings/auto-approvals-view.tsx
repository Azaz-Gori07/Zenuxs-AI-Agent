"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { desktopClient } from "@/lib/desktop-client";
import { PageFrame, PageHeader } from "../page-layout";

type PermissionCategory =
	| "read"
	| "read-out-of-workspace"
	| "write"
	| "write-out-of-workspace"
	| "mcp"
	| "mode"
	| "subtasks"
	| "execute"
	| "questions";

interface AutoApprovalsState {
	[permission: string]: boolean;
}

const PERMISSION_LABELS: Record<PermissionCategory, { label: string; description: string }> = {
	read: {
		label: "Read",
		description: "Allow reading files within workspace",
	},
	"read-out-of-workspace": {
		label: "Read out of workspace",
		description: "Allow reading files outside workspace",
	},
	write: {
		label: "Write",
		description: "Allow writing files within workspace",
	},
	"write-out-of-workspace": {
		label: "Write out of workspace",
		description: "Allow writing files outside workspace",
	},
	mcp: {
		label: "MCP",
		description: "Allow MCP server operations",
	},
	mode: {
		label: "Mode",
		description: "Allow switching between plan/act modes",
	},
	subtasks: {
		label: "Subtasks",
		description: "Allow creating and managing subtasks",
	},
	execute: {
		label: "Execute",
		description: "Allow executing commands",
	},
	questions: {
		label: "Questions",
		description: "Allow asking clarifying questions",
	},
};

const DEFAULT_APPROVALS: AutoApprovalsState = {
	read: true,
	write: true,
	"read-out-of-workspace": false,
	"write-out-of-workspace": false,
	mcp: true,
	mode: true,
	subtasks: true,
	execute: true,
	questions: false,
};

export function AutoApprovalsContent() {
	const [approvals, setApprovals] = useState<AutoApprovalsState>(DEFAULT_APPROVALS);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadApprovals = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await desktopClient.invoke<AutoApprovalsState>(
				"get_auto_approvals",
			);
			setApprovals({ ...DEFAULT_APPROVALS, ...data });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			void loadApprovals();
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, [loadApprovals]);

	const toggleApproval = async (permission: PermissionCategory, enabled: boolean) => {
		const previous = approvals[permission];
		setApprovals((prev) => ({ ...prev, [permission]: enabled }));
		setSaving(true);
		setError(null);
		try {
			await desktopClient.invoke("set_auto_approval", {
				permission,
				enabled,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
			setApprovals((prev) => ({ ...prev, [permission]: previous }));
		} finally {
			setSaving(false);
		}
	};

	const groupedPermissions = [
		{
			title: "File Operations",
			permissions: ["read", "write", "read-out-of-workspace", "write-out-of-workspace"] as PermissionCategory[],
		},
		{
			title: "Agent Controls",
			permissions: ["mode", "subtasks", "execute", "questions"] as PermissionCategory[],
		},
		{
			title: "External Access",
			permissions: ["mcp"] as PermissionCategory[],
		},
	];

	return (
		<PageFrame>
			<PageHeader
				description="Manage automatic approvals for different tool categories."
				title="Auto Approvals"
			/>

			{error && (
				<div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</div>
			)}

			{loading ? (
				<div className="rounded-lg border border-border px-5 py-8 text-center">
					<p className="text-sm text-muted-foreground">Loading approvals...</p>
				</div>
			) : (
				<ScrollArea className="max-w-[46rem]">
					<div className="space-y-6 pr-4">
						{groupedPermissions.map((group) => (
							<div key={group.title} className="rounded-lg border border-border">
								<div className="border-b px-5 py-3">
									<h3 className="text-sm font-semibold text-foreground">
										{group.title}
									</h3>
								</div>
								<div className="divide-y divide-border">
									{group.permissions.map((permission) => {
										const config = PERMISSION_LABELS[permission];
										const enabled = Boolean(approvals[permission]);
										return (
											<div
												key={permission}
												className="flex items-center justify-between gap-4 px-5 py-3.5"
											>
												<div className="space-y-0.5">
													<div className="text-sm font-medium text-foreground">
														{config.label}
													</div>
													<p className="text-xs text-muted-foreground">
														{config.description}
													</p>
												</div>
												<Switch
													checked={enabled}
													disabled={saving}
													onCheckedChange={(checked) =>
														void toggleApproval(permission, checked)
													}
												/>
											</div>
										);
									})}
								</div>
							</div>
						))}
					</div>
				</ScrollArea>
			)}
		</PageFrame>
	);
}