export function MarkdownBlock({ markdown }: { markdown?: string }) {
	if (!markdown) return null;
	const safeText = prepareStreamingMarkdown(markdown);
	const html = parseMarkdown(safeText);
	return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

function prepareStreamingMarkdown(rawText: string): string {
	let text = rawText;
	// Auto-close unclosed code block fences during token streaming to prevent layout shifts
	const fenceMatches = text.match(/```/g);
	if (fenceMatches && fenceMatches.length % 2 !== 0) {
		text += "\n```";
	}
	return text;
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseMarkdown(text: string): string {
	let html = escapeHtml(text);

	html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
		const label = lang || "code";
		return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-lang-label">${label}</span><button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.textContent);this.textContent='Copied';setTimeout(()=>this.textContent='Copy',1200)">Copy</button></div><pre class="code-block-content"><code>${code}</code></pre></div>`;
	});

	html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
	html = html.replace(/^##### (.+)$/gm, "<h5>$1</h5>");
	html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
	html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
	html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
	html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
	html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:4px;margin:6px 0;" />');

	html = html.replace(/^- \[x\] (.+)$/gim, '<li><input type="checkbox" checked disabled> $1</li>');
	html = html.replace(/^- \[ \] (.+)$/gim, '<li><input type="checkbox" disabled> $1</li>');

	html = html.replace(/(?:^|\n)\|(.+)\|\n\|([-| :]+)\|\n((?:\|.+\|\n?)*)/g, (match) => {
		const lines = match.trim().split("\n");
		if (lines.length < 3) return match;
		const headers = lines[0].split("|").filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join("");
		const rows = lines.slice(2).map(line => {
			const cells = line.split("|").filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join("");
			return `<tr>${cells}</tr>`;
		}).join("");
		return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
	});

	// GitHub-style callouts
	html = html.replace(/^> \[\!NOTE\]\s*(.+)$/gim, '<blockquote class="alert-note"><p><strong>NOTE:</strong> $1</p></blockquote>');
	html = html.replace(/^> \[\!WARNING\]\s*(.+)$/gim, '<blockquote class="alert-warning"><p><strong>WARNING:</strong> $1</p></blockquote>');
	html = html.replace(/^> \[\!TIP\]\s*(.+)$/gim, '<blockquote class="alert-tip"><p><strong>TIP:</strong> $1</p></blockquote>');

	html = html.replace(/^> (.+)$/gm, "<blockquote><p>$1</p></blockquote>");

	html = html.replace(/^\s*[-*]\s(.+)$/gm, "<li>$1</li>");
	html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

	html = html.replace(/^\d+\.\s(.+)$/gm, "<li>$1</li>");
	html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => match.includes("<ol>") || match.includes("</ol>") ? match : `<ol>${match}</ol>`);

	html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
	html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
	html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");
	html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

	html = html.replace(/\n\n/g, "</p><p>");
	html = html.replace(/\n/g, "<br />");
	html = "<p>" + html + "</p>";

	html = html.replace(/<p><\/p>/g, "");

	html = html.replace(/<blockquote>\s*<p>/g, "<blockquote><p>");
	html = html.replace(/<\/p>\s*<\/blockquote>/g, "</p></blockquote>");

	html = html.replace(/<(ul|ol)>\s*<p>/g, "<$1>");
	html = html.replace(/<\/p>\s*<\/(ul|ol)>/g, "</$1>");
	html = html.replace(/<li><p>/g, "<li>");
	html = html.replace(/<\/p><\/li>/g, "</li>");

	html = html.replace(/<br \/>\s*<(ul|ol|li|h[1-6]|blockquote|pre|div|table|thead|tbody|tr|th|td)/g, "<$1");
	html = html.replace(/(<\/(ul|ol|li|h[1-6]|blockquote|pre|div|table|thead|tbody|tr|th|td)>)\s*<br \/>/g, "$1");

	return html;
}