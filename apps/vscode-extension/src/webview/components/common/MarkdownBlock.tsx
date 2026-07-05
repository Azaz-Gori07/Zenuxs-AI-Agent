export function MarkdownBlock({ markdown }: { markdown?: string }) {
	if (!markdown) return null;
	const html = parseMarkdown(markdown);
	return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseMarkdown(text: string): string {
	let html = escapeHtml(text);

	html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
		const escaped = code.replace(/"/g, "&quot;");
		return `<div class="code-block-wrapper"><div class="code-block-header"><span>${lang || "code"}</span><button class="btn sm secondary" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.textContent);this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)">Copy</button></div><pre class="code-block-content"><code>${code}</code></pre></div>`;
	});

	html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
	html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
	html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

	html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:4px;margin:8px 0;" />');

	html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

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

	html = html.replace(/<br \/>\s*<(ul|ol|li|h[1-6]|blockquote|pre|div)/g, "<$1");
	html = html.replace(/(<\/(ul|ol|h[1-6]|blockquote|pre|div)>)\s*<br \/>/g, "$1");

	return html;
}
