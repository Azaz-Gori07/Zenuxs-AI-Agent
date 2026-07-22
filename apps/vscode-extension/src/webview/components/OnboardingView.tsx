import React, { useState, useEffect, useRef, useCallback } from "react";
import { postMessage } from "../vscode-api.js";

type Phase = "welcome" | "login";

interface OnboardingViewProps {
	onComplete?: () => void;
}

function StarField() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animId: number;
		const stars: { x: number; y: number; size: number; speed: number; opacity: number }[] = [];

		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};
		resize();
		window.addEventListener("resize", resize);

		for (let i = 0; i < 60; i++) {
			stars.push({
				x: Math.random() * canvas.width,
				y: Math.random() * canvas.height,
				size: Math.random() * 1.5 + 0.3,
				speed: Math.random() * 0.15 + 0.03,
				opacity: Math.random() * 0.5 + 0.1,
			});
		}

		let time = 0;
		const draw = () => {
			time += 0.002;
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			for (const star of stars) {
				const twinkle = Math.sin(time * 3 + star.x * 0.01) * 0.3 + 0.7;
				const alpha = star.opacity * twinkle;
				ctx.beginPath();
				ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
				ctx.fill();
			}
			animId = requestAnimationFrame(draw);
		};
		animId = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(animId);
			window.removeEventListener("resize", resize);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				zIndex: 0,
			}}
		/>
	);
}

const styles = {
	container: {
		position: "fixed" as const,
		inset: 0,
		zIndex: 1000,
		background: "linear-gradient(145deg, #08090c 0%, #0e0f15 40%, #0a0b12 70%, #08090c 100%)",
		color: "#f8fafc",
		display: "flex",
		flexDirection: "column" as const,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		userSelect: "none" as const,
		fontFamily: "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif)",
	},
	welcomeGlow: {
		position: "absolute" as const,
		width: 420,
		height: 420,
		borderRadius: "50%",
		background: "radial-gradient(circle, rgba(124, 58, 237, 0.2) 0%, rgba(6, 182, 212, 0.08) 35%, transparent 65%)",
		filter: "blur(60px)",
		pointerEvents: "none" as const,
		animation: "pulseGlow 4s ease-in-out infinite alternate",
	},
	welcomeGlowSecondary: {
		position: "absolute" as const,
		width: 300,
		height: 300,
		borderRadius: "50%",
		background: "radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, rgba(99, 102, 241, 0.06) 40%, transparent 65%)",
		filter: "blur(50px)",
		pointerEvents: "none" as const,
		animation: "pulseGlowSecondary 5s ease-in-out infinite alternate",
		top: "20%",
		right: "15%",
	},
	welcomeContent: {
		display: "flex",
		flexDirection: "column" as const,
		alignItems: "center",
		justifyContent: "center",
		position: "relative" as const,
		zIndex: 2,
		animation: "welcomeEntry 2.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
	},
	welcomeTitle: {
		fontSize: 32,
		fontWeight: 700,
		letterSpacing: "-0.02em",
		textAlign: "center" as const,
		lineHeight: 1.2,
		background: "linear-gradient(135deg, #ffffff 0%, #cbd5e1 40%, #a78bfa 70%, #22d3ee 100%)",
		backgroundClip: "text",
		WebkitBackgroundClip: "text",
		WebkitTextFillColor: "transparent",
		animation: "welcomeFloat 4s ease-in-out infinite alternate",
		transformStyle: "preserve-3d",
		perspective: 800,
	},
	welcomeSubtitle: {
		fontSize: 13,
		color: "rgba(255, 255, 255, 0.3)",
		marginTop: 16,
		letterSpacing: "0.15em",
		fontWeight: 400,
		textTransform: "uppercase" as const,
		opacity: 0,
		animation: "subtitleFadeIn 1.2s ease 1.5s forwards",
	},
	loginContainer: {
		display: "flex",
		flexDirection: "column" as const,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		maxWidth: 340,
		padding: "0 24px",
		position: "relative" as const,
		zIndex: 2,
		animation: "loginEntry 1s cubic-bezier(0.16, 1, 0.3, 1) forwards",
	},
	loginBadge: {
		fontSize: 10,
		textTransform: "uppercase" as const,
		letterSpacing: "0.12em",
		fontWeight: 600,
		color: "#a78bfa",
		background: "rgba(124, 58, 237, 0.1)",
		border: "1px solid rgba(124, 58, 237, 0.25)",
		padding: "4px 12px",
		borderRadius: 100,
		marginBottom: 16,
	},
	loginTitle: {
		fontSize: 24,
		fontWeight: 700,
		color: "#f8fafc",
		marginBottom: 8,
		letterSpacing: "-0.01em",
	},
	loginSubtitle: {
		fontSize: 13,
		color: "rgba(255, 255, 255, 0.4)",
		marginBottom: 28,
		textAlign: "center" as const,
		lineHeight: 1.5,
	},
	buttonsContainer: {
		width: "100%",
		display: "flex",
		flexDirection: "column" as const,
		gap: 10,
	},
	baseButton: {
		width: "100%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		gap: 10,
		padding: "13px 20px",
		borderRadius: 10,
		fontSize: 14,
		fontWeight: 600,
		cursor: "pointer",
		transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
		border: "1px solid transparent",
		fontFamily: "inherit",
		position: "relative" as const,
		outline: "none",
	},
	zenuxsButton: {
		background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #06b6d4 100%)",
		color: "#ffffff",
		boxShadow: "0 4px 24px rgba(124, 58, 237, 0.3)",
		border: "1px solid rgba(167, 139, 250, 0.15)",
	},
	clineButton: {
		background: "rgba(255, 255, 255, 0.04)",
		color: "#f1f5f9",
		border: "1px solid rgba(255, 255, 255, 0.1)",
		backdropFilter: "blur(8px)",
	},
	openaiButton: {
		background: "rgba(16, 185, 129, 0.06)",
		color: "#34d399",
		border: "1px solid rgba(16, 185, 129, 0.2)",
		backdropFilter: "blur(8px)",
	},
	skipButton: {
		background: "transparent",
		border: "none",
		color: "rgba(255, 255, 255, 0.35)",
		fontSize: 12,
		fontWeight: 500,
		cursor: "pointer",
		padding: "10px 6px 4px",
		transition: "color 0.2s ease",
		fontFamily: "inherit",
		outline: "none",
	},
	errorBox: {
		background: "rgba(244, 63, 94, 0.1)",
		border: "1px solid rgba(244, 63, 94, 0.25)",
		borderRadius: 8,
		padding: "10px 14px",
		fontSize: 12,
		color: "#f43f5e",
		textAlign: "center" as const,
		marginTop: 16,
		width: "100%",
		animation: "loginEntry 0.3s ease forwards",
	},
	spinner: {
		width: 16,
		height: 16,
		border: "2px solid rgba(255,255,255,0.2)",
		borderTopColor: "#ffffff",
		borderRadius: "50%",
		animation: "spin 0.6s linear infinite",
	},
	divider: {
		width: "100%",
		display: "flex",
		alignItems: "center",
		gap: 16,
		margin: "8px 0",
		opacity: 0.3,
	},
	dividerLine: {
		flex: 1,
		height: 1,
		background: "rgba(255,255,255,0.15)",
	},
	dividerText: {
		fontSize: 11,
		color: "rgba(255,255,255,0.4)",
		textTransform: "uppercase" as const,
		letterSpacing: "0.1em",
	},
} as const;

const providerIcons: Record<string, React.ReactNode> = {
	zenuxs: (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
		</svg>
	),
	cline: (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
		</svg>
	),
	"openai-codex": (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="10" />
			<path d="M12 8v8M8 12h8" />
		</svg>
	),
};

const transitionOverlay: Record<string, React.CSSProperties> = {
	transition: {
		position: "fixed",
		inset: 0,
		zIndex: 999,
		pointerEvents: "none",
		background: "#08090c",
		animation: "transitionBlur 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
	},
};

export function OnboardingView({ onComplete }: OnboardingViewProps) {
	const [phase, setPhase] = useState<Phase>("welcome");
	const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [transitioning, setTransitioning] = useState(false);
	const mountedRef = useRef(true);

	useEffect(() => {
		return () => {
			mountedRef.current = false;
		};
	}, []);

	// Auto-transition from welcome to login
	useEffect(() => {
		if (phase !== "welcome") return;
		const timer = setTimeout(() => {
			if (!mountedRef.current) return;
			setTransitioning(true);
			setTimeout(() => {
				if (!mountedRef.current) return;
				setPhase("login");
				setTransitioning(false);
			}, 1000);
		}, 2600);
		return () => clearTimeout(timer);
	}, [phase]);

	// Listen for login results from extension
	const handleMessage = useCallback((event: MessageEvent) => {
		const msg = event.data;
		if (!msg || typeof msg !== "object") return;

		if (msg.type === "oauth_status") {
			if (msg.status === "authenticating") {
				setLoadingProvider(msg.providerId);
				setError(null);
			} else if (msg.status === "error") {
				setLoadingProvider(null);
				setError(msg.message || "Authentication failed. Please try again.");
			} else if (msg.status === "success") {
				setLoadingProvider(null);
				setError(null);
				onComplete?.();
			}
			return;
		}

		if (msg.type === "initial_data") {
			if (msg.showOnboarding === false) {
				setLoadingProvider(null);
				setError(null);
				onComplete?.();
			}
			return;
		}

		if (msg.type === "error") {
			setLoadingProvider(null);
			setError(msg.text || "Authentication failed. Please try again.");
			return;
		}
	}, [onComplete]);

	useEffect(() => {
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [handleMessage]);

	const handleLogin = (providerId: string) => {
		if (loadingProvider) return;
		setLoadingProvider(providerId);
		setError(null);
		postMessage({ type: "login_oauth", providerId });
	};

	const handleSkip = () => {
		postMessage({ type: "skip_onboarding" });
		onComplete?.();
	};

	const buttonStyle = (providerId: string): React.CSSProperties => {
		const base = { ...styles.baseButton };
		if (providerId === "zenuxs") Object.assign(base, styles.zenuxsButton);
		else if (providerId === "cline") Object.assign(base, styles.clineButton);
		else if (providerId === "openai-codex") Object.assign(base, styles.openaiButton);
		if (loadingProvider && loadingProvider !== providerId) {
			Object.assign(base, { opacity: 0.4, cursor: "not-allowed" });
		}
		if (loadingProvider === providerId) {
			Object.assign(base, { cursor: "not-allowed" });
		}
		return base;
	};

	return (
		<div style={styles.container}>
			{transitioning && <div style={transitionOverlay.transition} />}

			{phase === "welcome" && (
				<>
					<StarField />
					<div style={styles.welcomeGlow} />
					<div style={styles.welcomeGlowSecondary} />
					<div style={styles.welcomeContent}>
						<div style={styles.welcomeTitle}>
							Welcome to<br />Zenuxs Code
						</div>
						<div style={styles.welcomeSubtitle}>AI-Powered Development</div>
					</div>
				</>
			)}

			{phase === "login" && (
				<>
					<StarField />
					<div style={styles.welcomeGlow} />
					<div style={styles.loginContainer}>
						<div style={styles.loginBadge}>Zenuxs Code</div>
						<div style={styles.loginTitle}>Sign in to Zenuxs</div>
						<div style={styles.loginSubtitle}>
							{loadingProvider
								? "Authenticating... Waiting for authentication approval... Please complete the login in your browser."
								: "Choose your preferred authentication method"}
						</div>

						<div style={styles.buttonsContainer}>
							<button
								style={buttonStyle("zenuxs")}
								onClick={() => handleLogin("zenuxs")}
								disabled={!!loadingProvider}
								onMouseEnter={(e) => {
									if (!loadingProvider) {
										e.currentTarget.style.transform = "translateY(-2px)";
										e.currentTarget.style.boxShadow = "0 8px 30px rgba(124, 58, 237, 0.45)";
									}
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.transform = "";
									e.currentTarget.style.boxShadow = "0 4px 24px rgba(124, 58, 237, 0.3)";
								}}
							>
								{loadingProvider === "zenuxs" ? (
									<div style={styles.spinner} />
								) : (
									providerIcons["zenuxs"]
								)}
								{loadingProvider === "zenuxs" ? "Authenticating..." : "Login with Zenuxs"}
							</button>

							<button
								style={buttonStyle("cline")}
								onClick={() => handleLogin("cline")}
								disabled={!!loadingProvider}
								onMouseEnter={(e) => {
									if (!loadingProvider) {
										e.currentTarget.style.transform = "translateY(-1px)";
										e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.25)";
										e.currentTarget.style.background = "rgba(255, 255, 255, 0.07)";
									}
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.transform = "";
									e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
									e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
								}}
							>
								{loadingProvider === "cline" ? (
									<div style={styles.spinner} />
								) : (
									providerIcons["cline"]
								)}
								{loadingProvider === "cline" ? "Authenticating..." : "Login with Cline"}
							</button>

							<div style={styles.divider}>
								<div style={styles.dividerLine} />
								<span style={styles.dividerText}>or</span>
								<div style={styles.dividerLine} />
							</div>

							<button
								style={buttonStyle("openai-codex")}
								onClick={() => handleLogin("openai-codex")}
								disabled={!!loadingProvider}
								onMouseEnter={(e) => {
									if (!loadingProvider) {
										e.currentTarget.style.transform = "translateY(-1px)";
										e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.35)";
										e.currentTarget.style.background = "rgba(16, 185, 129, 0.1)";
									}
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.transform = "";
									e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.2)";
									e.currentTarget.style.background = "rgba(16, 185, 129, 0.06)";
								}}
							>
								{loadingProvider === "openai-codex" ? (
									<div style={styles.spinner} />
								) : (
									providerIcons["openai-codex"]
								)}
								{loadingProvider === "openai-codex" ? "Authenticating..." : "Login with OpenAI ChatGPT"}
							</button>
						</div>

						{error && <div style={styles.errorBox}>{error}</div>}

						<button
							style={styles.skipButton}
							onClick={handleSkip}
							onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)"; }}
							onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255, 255, 255, 0.35)"; }}
						>
							Continue without Login &rarr;
						</button>
					</div>
				</>
			)}
		</div>
	);
}
