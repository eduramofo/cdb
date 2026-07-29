const AppArtifacts = {
    files: [],

    init() {
        App.showPageContent('artifacts', this.html());
    },

    html() {
        return `
            <div class="panel">
                <div class="panel-header">
                    <span>Arquivos de Evidências</span>
                    <span class="text-sm text-muted" id="artifacts-count">0 arquivos</span>
                </div>
                <div class="panel-body" style="padding:0;">
                    <div id="artifacts-list">
                        <div class="loading"><span class="spinner"></span> Carregando...</div>
                    </div>
                </div>
            </div>
            <div class="modal-overlay" id="artifact-modal">
                <div class="modal">
                    <div class="modal-header">
                        <span id="artifact-modal-title">Preview</span>
                        <button class="modal-close" onclick="AppArtifacts.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body" id="artifact-modal-body"></div>
                </div>
            </div>
        `;
    },

    async refresh() {
        App.showPageContent('artifacts', this.html());
        await this.load();
    },

    async load() {
        try {
            const data = await API.artifacts.list();
            this.files = data.files;
            document.getElementById('artifacts-count').textContent = `${data.total} arquivos`;

            if (!data.files.length) {
                document.getElementById('artifacts-list').innerHTML = `<div class="empty"><div class="empty-icon">📁</div><h3>Nenhum artifact</h3><p class="text-muted">Execute o RPA ou a carga HN para gerar evidências.</p></div>`;
                return;
            }

            let html = '<div class="table-container"><table><thead><tr>';
            ['Arquivo', 'Tamanho', 'Criado em', 'Ações'].forEach(h => html += `<th>${h}</th>`);
            html += '</tr></thead><tbody>';
            this.files.forEach(f => {
                const date = new Date(f.modified * 1000).toLocaleString('pt-BR');
                const icon = f.extension === '.png' ? '📷' : f.extension === '.json' ? '📄' : '📝';
                html += `<tr>
                    <td><span style="margin-right:6px;">${icon}</span><code>${App.esc(f.name)}</code></td>
                    <td>${App.esc(f.size_human)}</td>
                    <td class="text-sm text-muted">${date}</td>
                    <td><button class="btn btn-sm" onclick="AppArtifacts.preview('${App.esc(f.name)}')">Visualizar</button></td>
                </tr>`;
            });
            html += '</tbody></table></div>';
            document.getElementById('artifacts-list').innerHTML = html;
        } catch (e) {
            document.getElementById('artifacts-list').innerHTML = `<div class="alert alert-error">Erro: ${App.esc(e.message)}</div>`;
        }
    },

    async preview(filename) {
        const modal = document.getElementById('artifact-modal');
        const title = document.getElementById('artifact-modal-title');
        const body = document.getElementById('artifact-modal-body');
        title.textContent = filename;
        body.innerHTML = '<div class="loading"><span class="spinner"></span> Carregando...</div>';
        modal.classList.add('active');

        const ext = filename.split('.').pop().toLowerCase();
        const url = `/artifacts/${filename}`;

        try {
            if (ext === 'png') {
                body.innerHTML = `<img src="${url}" alt="${App.esc(filename)}" style="max-width:100%;border-radius:4px;">`;
            } else {
                const res = await fetch(url);
                const text = await res.text();
                try {
                    const parsed = JSON.parse(text);
                    body.innerHTML = `<pre><code>${App.esc(JSON.stringify(parsed, null, 2))}</code></pre>`;
                } catch {
                    body.innerHTML = `<pre><code>${App.esc(text)}</code></pre>`;
                }
            }
        } catch (e) {
            body.innerHTML = `<div class="alert alert-error">Erro ao carregar: ${App.esc(e.message)}</div>`;
        }
    },

    closeModal() {
        document.getElementById('artifact-modal').classList.remove('active');
    },
};

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.id === 'artifact-modal') AppArtifacts.closeModal();
});
