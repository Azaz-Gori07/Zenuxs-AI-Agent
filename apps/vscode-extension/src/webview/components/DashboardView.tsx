import { useExtensionState } from "../context/ExtensionStateContext.js";
import { useMemo } from "react";

export function DashboardView() {
	const { state } = useExtensionState();
	const dd = state.dashboardData;

	const total = useMemo(() => {
		const pMax = Math.max(...Object.values(dd.providerBreakdown), 1);
		const mMax = Math.max(...Object.values(dd.modelBreakdown), 1);
		const tMax = Math.max(...Object.values(dd.toolBreakdown), 1);
		return { pMax, mMax, tMax };
	}, [dd]);

	return (
		<div className="dashboard-container">
			<div className="metrics-grid">
				<div className="metric-card">
					<span className="metric-value">${dd.totalCost.toFixed(4)}</span>
					<span className="metric-label">Total Cost</span>
				</div>
				<div className="metric-card">
					<span className="metric-value">{dd.totalRequests}</span>
					<span className="metric-label">Total Runs</span>
				</div>
				<div className="metric-card">
					<span className="metric-value">{formatTokens(dd.inputTokens)}</span>
					<span className="metric-label">Input Tokens</span>
				</div>
				<div className="metric-card">
					<span className="metric-value">{formatTokens(dd.outputTokens)}</span>
					<span className="metric-label">Output Tokens</span>
				</div>
			</div>

			<div className="dashboard-charts">
				<div className="chart-section">
					<h3 className="breakdown-title">Usage by Provider</h3>
					{Object.keys(dd.providerBreakdown).length === 0 ? (
						<div className="text-muted text-center" style={{ padding: 10 }}>No data</div>
					) : (
						Object.entries(dd.providerBreakdown).map(([k, v]) => (
							<div key={k} className="chart-bar-row">
								<span className="chart-bar-label">{k}</span>
								<div className="chart-bar-track">
									<div className="chart-bar-fill provider" style={{ width: `${(v / total.pMax) * 100}%` }} />
								</div>
								<span className="chart-bar-value">{v}</span>
							</div>
						))
					)}
				</div>
				<div className="chart-section">
					<h3 className="breakdown-title">Usage by Model</h3>
					{Object.keys(dd.modelBreakdown).length === 0 ? (
						<div className="text-muted text-center" style={{ padding: 10 }}>No data</div>
					) : (
						Object.entries(dd.modelBreakdown).map(([k, v]) => (
							<div key={k} className="chart-bar-row">
								<span className="chart-bar-label">{k}</span>
								<div className="chart-bar-track">
									<div className="chart-bar-fill model" style={{ width: `${(v / total.mMax) * 100}%` }} />
								</div>
								<span className="chart-bar-value">{v}</span>
							</div>
						))
					)}
				</div>
				<div className="chart-section full-width">
					<h3 className="breakdown-title">Most Used Tools</h3>
					{Object.keys(dd.toolBreakdown).length === 0 ? (
						<div className="text-muted text-center" style={{ padding: 10 }}>No data</div>
					) : (
						Object.entries(dd.toolBreakdown).map(([k, v]) => (
							<div key={k} className="chart-bar-row">
								<span className="chart-bar-label">{k}</span>
								<div className="chart-bar-track">
									<div className="chart-bar-fill tools" style={{ width: `${(v / total.tMax) * 100}%` }} />
								</div>
								<span className="chart-bar-value">{v}</span>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return String(n);
}
