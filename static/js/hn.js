const AppHN = {
    currentPage: 1,
    pageSize: 25,
    autoLoading: false,
    autoLoaded: 0,
    autoBatch: 10,

    init() {
        App.showPageContent('hn', this.html());
    },

    html() {
        return `
            <div class="panel">
                <div class="panel-header">Carga</div>
                <div class="panel-body">
                    <div class="form-row">
                        <label>Batch:</label>
                        <input type="number" id="hn-load-limit" placeholder="Opcional" min="1" value="10" style="width:80px;">
                        <button class="btn btn-primary" id="hn-btn-load" onclick="AppHN.doLoad()">Carregar Manualmente</button>
                        <button class="btn" id="hn-btn-auto" onclick="AppHN.toggleAuto()">Carregar Automaticamente</button>
                        <span class="text-sm text-muted" id="hn-load-status"></span>
                    </div>
                    <div id="hn-auto-info" style="display:none;margin-top:6px;" class="text-sm text-muted"></div>
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

            <div class="modal-overlay" id="hn-detail-modal">
                <div class="modal" style="width:680px;">
                    <div class="modal-header">
                        <span id="hn-detail-title">Detalhes do Item</span>
                        <button class="modal-close" onclick="AppHN.closeDetail()">&times;</button>
                    </div>
                    <div class="modal-body" id="hn-detail-body"></div>
                </div>
            </div>
        `;
    },

    async refresh() {
        App.showPageContent('hn', this.html());
        this.currentPage = 1;
        this.autoLoading = false;
        this.autoLoaded = 0;
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
            ['ID', '', 'Tipo', 'Autor', 'Conteúdo', 'Score', 'Data'].forEach(h => html += `<th>${h}</th>`);
            html += '</tr></thead><tbody>';
            data.items.forEach(item => {
                const hasTitle = item.type === 'story' || item.type === 'job' || item.type === 'poll';
                const hasText = item.text && item.text.trim();
                let preview;
                if (hasTitle && item.title) {
                    preview = item.url
                        ? `<a href="${App.esc(item.url)}" target="_blank" style="color:var(--primary)">${App.esc(item.title)}</a>`
                        : App.esc(item.title);
                } else if (hasText) {
                    const plain = item.text.replace(/<[^>]*>/g, '').trim();
                    preview = App.truncate(plain, 80);
                } else {
                    preview = '<span class="text-muted">(sem conteúdo)</span>';
                }
                const typeBadge = { story: 'badge-info', comment: 'badge-warning', job: 'badge-success', poll: 'badge-info', pollopt: 'badge' };
                html += `<tr>
                    <td><code>${item.id}</code></td>
                    <td><button class="btn btn-sm" onclick="AppHN.showDetail(${item.id})">Ver</button></td>
                    <td><span class="badge ${typeBadge[item.type] || 'badge'}">${App.esc(item.type) || '-'}</span></td>
                    <td>${App.esc(item.by) || '-'}</td>
                    <td class="code">${preview}</td>
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

    prevPage() {
        if (this.currentPage <= 1) return;
        this.currentPage--;
        this.loadItems();
    },
    nextPage() {
        const totalStr = document.getElementById('hn-item-count').textContent;
        const total = parseInt(totalStr) || 0;
        const maxPages = Math.ceil(total / this.pageSize) || 1;
        if (this.currentPage >= maxPages) return;
        this.currentPage++;
        this.loadItems();
    },

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
            this.currentPage = 1;
            await this.load();
        } catch (e) {
            status.textContent = `Erro: ${e.message}`;
        }
        btn.disabled = false;
        btn.innerHTML = 'Carregar Manualmente';
    },

    toggleAuto() {
        if (this.autoLoading) {
            this.stopAuto();
        } else {
            this.startAuto();
        }
    },

    async startAuto() {
        this.autoLoading = true;
        this.autoLoaded = 0;
        const btn = document.getElementById('hn-btn-auto');
        const loadBtn = document.getElementById('hn-btn-load');
        const info = document.getElementById('hn-auto-info');
        const status = document.getElementById('hn-load-status');
        const limitVal = document.getElementById('hn-load-limit').value;
        const limit = parseInt(limitVal) || this.autoBatch;

        btn.textContent = 'Parar';
        btn.className = 'btn btn-danger';
        loadBtn.disabled = true;
        info.style.display = 'block';
        status.textContent = 'Carregamento automático iniciado...';

        while (this.autoLoading) {
            try {
                const report = await API.hn.load(limit);
                const ins = report.inserted || 0;
                const upd = report.updated || 0;
                const ign = report.ignored || 0;
                this.autoLoaded += ins + upd + ign;

                info.textContent = `Batch: ${this.autoLoaded} itens processados | range ${report.range_start}–${report.range_end} | ${ins} novos, ${upd} atualizados`;

                if (ins > 0) App.toast(`${ins} novo${ins > 1 ? 's' : ''} iten${ins > 1 ? 's' : ''} carregado${ins > 1 ? 's' : ''}`, 'success');
                if (upd > 0) App.toast(`${upd} iten${upd > 1 ? 's' : ''} atualizado${upd > 1 ? 's' : ''}`,'info');

                if (report.total_consulted === 0) {
                    status.textContent = 'Aguardando novos itens...';
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    status.textContent = `${report.duration_seconds}s — batch concluído`;
                    await this.loadStatus();
                    await this.loadItems();
                    await new Promise(r => setTimeout(r, 300));
                }
            } catch (e) {
                status.textContent = `Erro no batch: ${e.message}`;
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        this.stopAuto();
    },

    stopAuto() {
        this.autoLoading = false;
        const btn = document.getElementById('hn-btn-auto');
        const loadBtn = document.getElementById('hn-btn-load');
        btn.textContent = 'Carregar Automaticamente';
        btn.className = 'btn';
        loadBtn.disabled = false;
        this.load();
    },

    showDetail(id) {
        API.hn.getItems(200, 0).then(data => {
            const item = data.items.find(it => it.id === id);
            this.renderDetail(item, id);
        }).catch(() => {
            this.renderDetail(null, id);
        });
    },

    renderDetail(item, id) {
        const title = document.getElementById('hn-detail-title');
        const body = document.getElementById('hn-detail-body');

        if (!item) {
            title.textContent = `Item #${id}`;
            body.innerHTML = `<div class="alert alert-info">Detalhes do item #${id} não disponíveis na página atual. Recarregue a página ou busque diretamente.</div>`;
        } else {
            title.textContent = `${item.type ? item.type.toUpperCase() : 'Item'} #${item.id}`;
            const typeCls = { story: 'badge-info', comment: 'badge-warning', job: 'badge-success', poll: 'badge-info', pollopt: 'badge' };
            body.innerHTML = `
                <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
                    <div><span class="text-sm text-muted">Tipo</span><br><span class="badge ${typeCls[item.type] || 'badge'}">${App.esc(item.type) || '-'}</span></div>
                    <div><span class="text-sm text-muted">Autor</span><br><strong>${App.esc(item.by) || '-'}</strong></div>
                    <div><span class="text-sm text-muted">Score</span><br><strong>${item.score ?? '-'}</strong></div>
                    <div><span class="text-sm text-muted">Comentários</span><br><strong>${item.descendants ?? 0}</strong></div>
                    <div><span class="text-sm text-muted">Data</span><br><strong>${App.fmtTs(item.time)}</strong></div>
                </div>
                ${item.title ? `<h3 style="margin:0 0 12px;">${App.esc(item.title)}</h3>` : ''}
                ${item.url ? `<p class="text-sm"><a href="${App.esc(item.url)}" target="_blank" style="color:var(--primary)">${App.esc(item.url)}</a></p>` : ''}
                ${item.text ? `<div style="margin-top:12px;padding:12px;background:#f8fafc;border-radius:6px;line-height:1.7;font-size:13px;max-height:400px;overflow-y:auto;" class="hn-text">${item.text}</div>` : ''}
                ${!item.title && !item.url && !item.text ? '<p class="text-muted">Item sem conteúdo textual (possivelmente deletado).</p>' : ''}
            `;
        }
        document.getElementById('hn-detail-modal').classList.add('active');
    },

    closeDetail() {
        document.getElementById('hn-detail-modal').classList.remove('active');
    },
};
