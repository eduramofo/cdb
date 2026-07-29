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
        const lines = md.split('\n');
        const out = [];
        const para = [];
        let i = 0;

        function flush() {
            if (!para.length) return;
            out.push('<p>' + para.join(' ') + '</p>');
            para.length = 0;
        }

        function parseInline(text) {
            let t = App.esc(text);
            t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
            t = t.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
            t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
            t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
            return t;
        }

        while (i < lines.length) {
            const line = lines[i];

            if (/^```/.test(line)) {
                flush();
                let code = '';
                i++;
                while (i < lines.length && !/^```/.test(lines[i])) {
                    code += (code ? '\n' : '') + lines[i];
                    i++;
                }
                i++;
                out.push('<pre><code>' + App.esc(code) + '</code></pre>');
                continue;
            }

            if (/^#{1,4} /.test(line)) {
                flush();
                const m = line.match(/^(#{1,4}) (.+)$/);
                const level = m[1].length;
                out.push(`<h${level}>${parseInline(m[2])}</h${level}>`);
                i++;
                continue;
            }

            if (/^> /.test(line)) {
                flush();
                out.push('<blockquote>' + parseInline(line.replace(/^> /, '')) + '</blockquote>');
                i++;
                continue;
            }

            if (/^---\s*$/.test(line)) {
                flush();
                out.push('<hr>');
                i++;
                continue;
            }

            if (/^[\s]*[-*+] /.test(line)) {
                flush();
                out.push('<ul>');
                while (i < lines.length && /^[\s]*[-*+] /.test(lines[i])) {
                    out.push('<li>' + parseInline(lines[i].replace(/^[\s]*[-*+] /, '')) + '</li>');
                    i++;
                }
                out.push('</ul>');
                continue;
            }

            if (/^\d+\. /.test(line)) {
                flush();
                out.push('<ol>');
                while (i < lines.length && /^\d+\. /.test(lines[i])) {
                    out.push('<li>' + parseInline(lines[i].replace(/^\d+\. /, '')) + '</li>');
                    i++;
                }
                out.push('</ol>');
                continue;
            }

            if (line.startsWith('|') && line.endsWith('|') && i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1])) {
                flush();
                const headers = line.split('|').filter(c => c.trim()).map(c => '<th>' + parseInline(c.trim()) + '</th>');
                out.push('<table><thead><tr>' + headers.join('') + '</tr></thead><tbody>');
                i += 2;
                while (i < lines.length && lines[i].startsWith('|')) {
                    const cells = lines[i].split('|').filter(c => c.trim()).map(c => '<td>' + parseInline(c.trim()) + '</td>');
                    out.push('<tr>' + cells.join('') + '</tr>');
                    i++;
                }
                out.push('</tbody></table>');
                continue;
            }

            if (line.trim() === '') {
                flush();
                i++;
                continue;
            }

            para.push(parseInline(line));
            i++;
        }

        flush();
        return out.join('\n');
    },
};
