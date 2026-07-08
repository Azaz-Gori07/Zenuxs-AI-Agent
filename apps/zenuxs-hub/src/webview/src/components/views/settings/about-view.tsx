"use client";

import { Github, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { desktopClient } from "@/lib/desktop-client";
import { PageFrame, PageHeader } from "../page-layout";

export function AboutContent() {
	const [version, setVersion] = useState("1.0.0");

	useEffect(() => {
		const loadVersion = async () => {
			try {
				const data = await desktopClient.invoke<{ version?: string }>("get_app_info");
				if (data?.version) {
					setVersion(data.version);
				}
			} catch {
				// fallback to default version
			}
		};
		void loadVersion();
	}, []);
	
	const openGitHub = () => {
		window.open("https://github.com/Azaz-Gori07/Zenuxs-AI-Agent", "_blank");
	};

	return (
		<PageFrame>
			<PageHeader
				description="Information about Zenuxs Code"
				title="About"
			/>

			<div className="max-w-[46rem] space-y-6">
				{/* Logo and Welcome */}
				<div className="rounded-lg border border-border p-8 text-center">
					<div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10">
						<svg
							className="h-16 w-16 text-primary"
							viewBox="0 0 100 100"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" opacity="0.9" />
							<path
								d="M50 20 L50 50 L70 60"
								stroke="currentColor"
								strokeWidth="3"
								strokeLinecap="round"
								opacity="0.8"
							/>
						</svg>
					</div>
					<h2 className="text-2xl font-bold text-foreground">Welcome to Zenuxs</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						Your intelligent coding companion powered by AI
					</p>
				</div>

				{/* Version Info */}
				<div className="rounded-lg border border-border">
					<div className="border-b px-5 py-3">
						<h3 className="text-sm font-semibold text-foreground">Version Information</h3>
					</div>
					<div className="px-5 py-4 space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">Current Version</span>
							<span className="text-sm font-mono text-foreground">{version}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">Application</span>
							<span className="text-sm text-foreground">Zenuxs Code</span>
						</div>
					</div>
				</div>

				{/* About Description */}
				<div className="rounded-lg border border-border p-5">
					<h3 className="mb-3 text-sm font-semibold text-foreground">About Zenuxs Code</h3>
					<p className="text-sm text-muted-foreground leading-relaxed">
						Zenuxs Code is an advanced AI-powered development environment that helps you write better code faster. 
						With intelligent code completion, automated reviews, and seamless integrations, Zenuxs empowers 
						developers to focus on what matters most - building great software.
					</p>
					<p className="mt-3 text-sm text-muted-foreground leading-relaxed">
						Built with modern technologies and designed for extensibility, Zenuxs supports multiple AI providers, 
						custom skills, and a robust plugin ecosystem to enhance your development workflow.
					</p>
				</div>

				{/* Links */}
				<div className="rounded-lg border border-border">
					<div className="border-b px-5 py-3">
						<h3 className="text-sm font-semibold text-foreground">Resources</h3>
					</div>
					<div className="divide-y">
						<Button
							variant="ghost"
							className="flex w-full items-center justify-between rounded-none px-5 py-4 hover:bg-accent/50"
							onClick={openGitHub}
						>
							<div className="flex items-center gap-3">
								<Github className="h-5 w-5 text-muted-foreground" />
								<div className="text-left">
									<p className="text-sm font-medium text-foreground">GitHub Repository</p>
									<p className="text-xs text-muted-foreground">View source code and contribute</p>
								</div>
							</div>
							<ExternalLink className="h-4 w-4 text-muted-foreground" />
						</Button>
					</div>
				</div>
			</div>
		</PageFrame>
	);
}