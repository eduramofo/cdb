const AppDocs = {
    tree: [],
    currentPath: null,
    loaded: false,

    init() {
        App.showPageContent('docs', this.html());
    },

    iconFor(name) {
        if (name.endsWith('.pdf')) return '📕';
        if (name.endsWith('.md')) return '📝';
        if (name.endsWith('.txt')) return '📋';
        return '📄';
    },

    html() {
        return `
            <div class="docs-layout" style="height:calc(100vh - 65px);">
                <div class="docs-sidebar" id="docs-tree">
                    <div class="loading"><span class="spinner"></span> Carregando...</div>
                </div>
                <div class="docs-content" id="docs-content">
                    <div class="empty">
                        <div class="empty-icon">📖</div>
                        <h3>Selecione um documento</h3>
                        <p class="text-muted">Escolha um arquivo na árvore à esquerda.</p>
                    </div>
                </div>
            </div>
        `;
    },

    async refresh() {
        App.showPageContent('docs', this.html());
        this.loaded = false;
        this.currentPath = null;
        await this.load();
    },

    async load() {
        try {
            const data = await API._fetch('/api/v1/docs');
            this.tree = data.tree;
            this.renderTree();
            if (!this.loaded && this.tree.length > 0) {
                this.loaded = true;
                const firstFile = this.tree[0];
                if (firstFile.type === 'file') {
                    this.selectDocByUrl(firstFile.url, firstFile.path);
                }
            }
        } catch (e) {
            document.getElementById('docs-tree').innerHTML = `<div class="alert alert-error">Erro: ${App.esc(e.message)}</div>`;
        }
    },

    renderTree() {
        const el = document.getElementById('docs-tree');
        let html = '<ul class="docs-tree">';
        this.tree.forEach(node => {
            html += this.renderNode(node);
        });
        html += '</ul>';
        el.innerHTML = html;

        this.tree.forEach(node => {
            if (node.type === 'folder') {
                const folderEl = el.querySelector(`[data-folder="${App.esc(node.name)}"]`);
                if (folderEl) {
                    folderEl.querySelector('.docs-folder-toggle').addEventListener('click', () => {
                        this.toggleFolder(folderEl);
                    });
                }
            }
        });
    },

    renderNode(node) {
        if (node.type === 'folder') {
            let html = `<li class="docs-tree-folder" data-folder="${App.esc(node.name)}">`;
            html += `<div class="docs-folder-row">`;
            html += `<span class="docs-folder-toggle">▼</span>`;
            html += `<span class="docs-folder-icon">📁</span>`;
            html += `<span class="docs-folder-label">${App.esc(node.name).replace(/_/g, ' ')}</span>`;
            html += `</div>`;
            if (node.children) {
                html += `<ul class="docs-tree-children">`;
                node.children.forEach(child => {
                    const isPdf = child.name.endsWith('.pdf');
                    const cls = this.currentPath === child.path ? ' active' : '';
                    const icon = this.iconFor(child.name);
                    html += `<li><a class="docs-tree-link${cls}" data-path="${App.esc(child.path)}" data-url="${App.esc(child.url)}" data-type="${isPdf ? 'pdf' : 'text'}" onclick="AppDocs.selectDoc(this)"><span class="docs-tree-icon">${icon}</span>${App.esc(child.name)}</a></li>`;
                });
                html += `</ul>`;
            }
            html += `</li>`;
            return html;
        } else {
            const isPdf = node.name.endsWith('.pdf');
            const cls = this.currentPath === node.path ? ' active' : '';
            const icon = this.iconFor(node.name);
            return `<li><a class="docs-tree-link docs-tree-root-file${cls}" data-path="${App.esc(node.path)}" data-url="${App.esc(node.url)}" data-type="${isPdf ? 'pdf' : 'text'}" onclick="AppDocs.selectDoc(this)"><span class="docs-tree-icon">${icon}</span>${App.esc(node.name)}</a></li>`;
        }
    },

    toggleFolder(el) {
        el.classList.toggle('collapsed');
    },

    selectDoc(el) {
        const path = el.dataset.path;
        const url = el.dataset.url;
        const type = el.dataset.type;
        this.selectDocByUrl(url, path, type);
    },

    async selectDocByUrl(url, path, type) {
        this.currentPath = path;

        const activeStates = document.querySelectorAll('.docs-tree-link, .docs-tree-root-file');
        if (activeStates.length) {
            activeStates.forEach(a => a.classList.remove('active'));
            const matched = document.querySelector(`[data-path="${CSS.escape(path)}"]`);
            if (matched) matched.classList.add('active');
        }

        const content = document.getElementById('docs-content');
        content.innerHTML = '<div class="loading"><span class="spinner"></span> Carregando...</div>';

        if (type === 'pdf') {
            content.innerHTML = `
                <div class="pdf-container">
                    <embed src="${url}" type="application/pdf" class="pdf-viewer">
                    <div class="pdf-fallback">
                        <p class="text-muted text-sm">Se o PDF não carregar, <a href="${url}" target="_blank">abra em nova aba</a>.</p>
                    </div>
                </div>`;
            return;
        }

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to load doc');
            const text = await res.text();
            content.innerHTML = this.renderMarkdown(text);
        } catch (e) {
            content.innerHTML = `<div class="alert alert-error">Erro ao carregar documento: ${App.esc(e.message)}</div>`;
        }
    },

    renderMarkdown(md) {
        let html = md;
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
            return `<pre><code>${App.esc(code.trimEnd())}</code></pre>`;
        });
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
        html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
        html = html.replace(/^---$/gm, '<hr>');

        const lines = html.split('\n');
        let result = '';
        let inCodeBlock = false;
        let inList = false;
        let inTable = false;
        let paragraph = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('<pre>')) {
                if (paragraph.length) { result += '<p>' + paragraph.join(' ') + '</p>\n'; paragraph = []; }
                inCodeBlock = true;
                result += line + '\n';
                continue;
            }
            if (line.startsWith('</pre>')) {
                inCodeBlock = false;
                result += line + '\n';
                continue;
            }
            if (inCodeBlock) { result += line + '\n'; continue; }

            if (line.trim() === '') {
                if (paragraph.length) { result += '<p>' + paragraph.join(' ') + '</p>\n'; paragraph = []; }
                if (inList) { result += '</ul>\n'; inList = false; }
                continue;
            }

            if (/^<h[1-4]>/.test(line) || /^<hr/.test(line) || /^<blockquote>/.test(line) || line.startsWith('|')) {
                if (paragraph.length) { result += '<p>' + paragraph.join(' ') + '</p>\n'; paragraph = []; }
                if (inList) { result += '</ul>\n'; inList = false; }

                if (line.startsWith('|')) {
                    if (!inTable) { inTable = true; }
                    if (line.includes('---')) { result += ''; continue; }
                    const cells = line.split('|').filter(c => c.trim()).map(c => {
                        const next = lines[i + 1];
                        const tag = next && next.includes('---') ? 'th' : 'td';
                        return `<${tag}>${c.trim()}</${tag}>`;
                    });
                    if (inTable && !lines[i - 1]?.includes('---')) {
                        result += `<tr>${cells.join('')}</tr>\n`;
                    }
                    continue;
                } else {
                    if (inTable) { inTable = false; }
                }

                result += line + '\n';
                continue;
            }

            if (/^[\s]*[-*+] (.+)/.test(line)) {
                if (!inList) { result += '<ul>\n'; inList = true; }
                result += '<li>' + line.replace(/^[\s]*[-*+] /, '') + '</li>\n';
                continue;
            }

            if (inList) { result += '</ul>\n'; inList = false; }

            paragraph.push(line);
        }

        if (paragraph.length) { result += '<p>' + paragraph.join(' ') + '</p>\n'; }
        if (inList) { result += '</ul>\n'; }

        result = result.replace(/(<tr>[\s\S]*?<\/tr>)/g, (match) => {
            if (match.startsWith('<table>')) return match;
            return '<table>' + match + '</table>';
        });

        return result.trim();
    },
};
