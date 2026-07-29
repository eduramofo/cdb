const AppHN = {
    currentPage: 1,
    pageSize: 100,

    init() {
        App.showPageContent('hn', this.html());
    },

    html() {
        return `
            <div class="panel">
                <div class="panel-header">Carga</div>
                <div class="panel-body">
                    <div class="form-row">
                        <label>Limit:</label>
                        <input type="number" id="hn-load-limit" placeholder="Opcional" min="1" value="10" style="width:100px;">
                        <button class="btn btn-primary" id="hn-btn-load" onclick="AppHN.doLoad()">Carregar Itens</button>
                        <span class="text-sm text-muted" id="hn-load-status"></span>
                    </div>
                </div>
            </div>
            <div class="cards" id="hn-status-cards">
                <div class="card info"><div class="card-label">Carregando...</div></div>
            </div>
            <div class="panel">
                <div class="panel-header">
                    <span>Itens</span>
                    <span class="text-sm text-muted" id="hn-item-count">0 itens</span>
                </div>
                <div class="panel-body" style="padding:0;">
                    <div id="hn-items-container">
                        <div class="loading"><span class="spinner"></span> Carregando...</div>
                    </div>
                </div>
                <div style="padding:8px 16px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:center;gap:8px;">
                    <button class="btn btn-sm" id="hn-btn-prev" onclick="AppHN.prevPage()" disabled>Anterior</button>
                    <span class="text-sm text-muted" id="hn-page-info">Página 1</span>
                    <button class="btn btn-sm" id="hn-btn-next" onclick="AppHN.nextPage()">Próximo</button>
                </div>
            </div>
        `;
    },

    async refresh() {
        App.showPageContent('hn', this.html());
        this.currentPage = 1;
        await this.load();
    },

    async load() {
        await this.loadStatus();
        await this.loadItems();
    },

    async loadStatus() {
        try {
            const st = await API.hn.status();
            const badges = Object.entries(st.items_by_type || {})
                .map(([k, v]) => `<span class="badge badge-info">${App.esc(k)}: ${v}</span>`)
                .join(' ');
            document.getElementById('hn-status-cards').innerHTML = `
                <div class="card info">
                    <div class="card-label">Watermark</div>
                    <div class="card-value">${st.last_processed_id ?? '-'}</div>
                    <div class="card-detail">último ID processado</div>
                </div>
                <div class="card success">
                    <div class="card-label">Total de Itens</div>
                    <div class="card-value">${st.total_items}</div>
                    <div class="card-detail">persistidos no banco</div>
                </div>
                <div class="card">
                    <div class="card-label">Distribuição por Tipo</div>
                    ${st.total_items ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">${badges}</div>` : '<div class="card-detail">Nenhum item carregado</div>'}
                </div>
            `;
        } catch {
            document.getElementById('hn-status-cards').innerHTML = `<div class="card danger"><div class="card-value" style="color:var(--danger)">Erro ao carregar status</div></div>`;
        }
    },

    async loadItems() {
        const container = document.getElementById('hn-items-container');
        container.innerHTML = '<div class="loading"><span class="spinner"></span> Carregando...</div>';
        try {
            const data = await API.hn.getItems(this.pageSize, (this.currentPage - 1) * this.pageSize);
            document.getElementById('hn-item-count').textContent = `${data.total} itens`;
            this.updatePagination(data.total);

            if (!data.items.length) {
                container.innerHTML = `<div class="empty"><div class="empty-icon">📰</div><h3>Nenhum item</h3><p class="text-muted">Use a carga para importar itens da HN API.</p></div>`;
                return;
            }

            let html = '<div class="table-container"><table><thead><tr>';
            ['ID', 'Tipo', 'Autor', 'Título', 'Score', 'Data'].forEach(h => html += `<th>${h}</th>`);
            html += '</tr></thead><tbody>';
            data.items.forEach(item => {
                html += `<tr>
                    <td><code>${item.id}</code></td>
                    <td><span class="badge badge-info">${App.esc(item.type) || '-'}</span></td>
                    <td>${App.esc(item.by) || '-'}</td>
                    <td class="code">${item.url ? `<a href="${App.esc(item.url)}" target="_blank" style="color:var(--primary)">${App.esc(item.title) || '(sem título)'}</a>` : App.esc(item.title) || '(sem título)'}</td>
                    <td>${item.score ?? '-'}</td>
                    <td class="text-sm text-muted">${App.fmtTs(item.time)}</td>
                </tr>`;
            });
            html += '</tbody></table></div>';
            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = `<div class="alert alert-error">Erro: ${App.esc(e.message)}</div>`;
        }
    },

    updatePagination(total) {
        const maxPages = Math.ceil(total / this.pageSize) || 1;
        document.getElementById('hn-page-info').textContent = `Página ${this.currentPage} de ${maxPages}`;
        document.getElementById('hn-btn-prev').disabled = this.currentPage <= 1;
        document.getElementById('hn-btn-next').disabled = this.currentPage >= maxPages;
    },

    prevPage() { if (this.currentPage > 1) { this.currentPage--; this.loadItems(); } },
    nextPage() { this.currentPage++; this.loadItems(); },

    async doLoad() {
        const btn = document.getElementById('hn-btn-load');
        const status = document.getElementById('hn-load-status');
        const limitVal = document.getElementById('hn-load-limit').value;
        const limit = limitVal ? parseInt(limitVal) : null;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Carregando...';
        status.textContent = 'Conectando à HN API...';
        try {
            const report = await API.hn.load(limit);
            const lines = [];
            if (report.inserted > 0) lines.push(`${report.inserted} inseridos`);
            if (report.updated > 0) lines.push(`${report.updated} atualizados`);
            if (report.ignored > 0) lines.push(`${report.ignored} ignorados`);
            if (report.failed > 0) lines.push(`${report.failed} falhas`);
            status.textContent = `${report.duration_seconds}s — ${lines.join(', ') || 'sem novidades'}`;
            await this.load();
        } catch (e) {
            status.textContent = `Erro: ${e.message}`;
        }
        btn.disabled = false;
        btn.innerHTML = 'Carregar Itens';
    },
};
