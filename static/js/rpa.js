const AppRPA = {
    records: [],
    running: false,

    init() {
        App.showPageContent('rpa', this.html());
    },

    html() {
        return `
            <div class="alert alert-info">
                <strong>Workflow:</strong> Baixe a planilha → Execute a automação → Confira os registros
            </div>
            <div class="panel">
                <div class="panel-header">Controles</div>
                <div class="panel-body">
                    <div class="btn-group">
                        <button class="btn btn-primary" id="rpa-btn-download" onclick="AppRPA.download()">
                            Download da Planilha
                        </button>
                        <button class="btn btn-success" id="rpa-btn-run" onclick="AppRPA.run(false)">
                            Executar Automação (Headless)
                        </button>
                        <button class="btn" id="rpa-btn-run-headed" onclick="AppRPA.run(true)">
                            Executar (Headed)
                        </button>
                        <button class="btn btn-danger btn-sm" id="rpa-btn-reset" onclick="AppRPA.reset()">
                            Resetar Base
                        </button>
                    </div>
                    <div id="rpa-status" class="text-sm text-muted mt-2"></div>
                </div>
            </div>
            <div class="panel">
                <div class="panel-header">
                    <span>Registros</span>
                    <span class="text-sm text-muted" id="rpa-count"></span>
                </div>
                <div class="panel-body" style="padding:0;">
                    <div id="rpa-records-container">
                        <div class="empty">
                            <div class="empty-icon">📄</div>
                            <h3>Nenhum registro</h3>
                            <p class="text-muted">Clique em "Download da Planilha" para começar.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="rpa-loading-modal">
                <div class="modal modal-sm">
                    <div class="modal-body" style="text-align:center;padding:40px 32px;">
                        <span class="spinner" style="width:32px;height:32px;border-width:3px;margin-bottom:16px;"></span>
                        <p style="font-weight:600;font-size:15px;">Executando automação...</p>
                        <p class="text-muted text-sm" id="rpa-loading-msg">Isso pode levar alguns segundos.</p>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="rpa-result-modal">
                <div class="modal">
                    <div class="modal-header">
                        <span>Resultado da Execução</span>
                        <button class="modal-close" onclick="AppRPA.closeResultModal()">&times;</button>
                    </div>
                    <div class="modal-body" id="rpa-result-body"></div>
                </div>
            </div>
        `;
    },

    async refresh() {
        App.showPageContent('rpa', this.html());
        await this.load();
    },

    async load() {
        try {
            const res = await API.rpa.getRecords();
            this.records = res.records;
            this.renderRecords();
        } catch (e) {
            document.getElementById('rpa-records-container').innerHTML = `<div class="alert alert-error">Erro: ${App.esc(e.message)}</div>`;
        }
    },

    renderRecords() {
        const el = document.getElementById('rpa-records-container');
        const count = document.getElementById('rpa-count');
        if (!this.records.length) {
            el.innerHTML = `<div class="empty"><div class="empty-icon">📄</div><h3>Nenhum registro</h3><p class="text-muted">Clique em "Download da Planilha" para começar.</p></div>`;
            count.textContent = '0 registros';
            return;
        }
        count.textContent = `${this.records.length} registros`;
        const cols = ['first_name', 'last_name', 'company_name', 'role_in_company', 'address', 'email', 'phone_number'];
        const labels = ['Nome', 'Sobrenome', 'Empresa', 'Cargo', 'Endereço', 'Email', 'Telefone'];
        let html = '<div class="table-container"><table><thead><tr>';
        labels.forEach(l => html += `<th>${l}</th>`);
        html += '</tr></thead><tbody>';
        this.records.forEach(r => {
            html += '<tr>';
            cols.forEach(c => html += `<td>${App.esc(r[c]) || '-'}</td>`);
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        el.innerHTML = html;
    },

    async download() {
        const btn = document.getElementById('rpa-btn-download');
        const status = document.getElementById('rpa-status');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Baixando...';
        status.textContent = 'Fazendo download da planilha...';
        try {
            const res = await API.rpa.downloadSheet();
            status.textContent = `Download concluído: ${res.total_downloaded} registros, ${res.inserted} inseridos.`;
            await this.load();
        } catch (e) {
            status.textContent = `Erro: ${e.message}`;
        }
        btn.disabled = false;
        btn.innerHTML = 'Download da Planilha';
    },

    async run(headed) {
        if (this.running) return;
        this.running = true;

        const btnRun = document.getElementById('rpa-btn-run');
        const btnHeaded = document.getElementById('rpa-btn-run-headed');
        const status = document.getElementById('rpa-status');
        const loadingModal = document.getElementById('rpa-loading-modal');
        const loadingMsg = document.getElementById('rpa-loading-msg');

        btnRun.disabled = true;
        btnHeaded.disabled = true;
        status.textContent = '';
        loadingModal.classList.add('active');

        try {
            if (!this.records.length) {
                loadingMsg.textContent = 'Baixando planilha...';
                status.textContent = 'Nenhum registro — fazendo download primeiro...';
                await API.rpa.downloadSheet();
                await this.load();
            }

            loadingMsg.textContent = headed ? 'Navegador visível — não feche a janela.' : 'Executando em modo headless...';
            status.textContent = 'Automação em andamento...';

            const res = await API.rpa.run(headed);
            status.textContent = 'Concluído!';
            loadingModal.classList.remove('active');
            this.showResult(res);
        } catch (e) {
            loadingModal.classList.remove('active');
            status.textContent = '';
            this.showResultError(e.message);
        }

        btnRun.disabled = false;
        btnHeaded.disabled = false;
        this.running = false;
    },

    showResult(stats) {
        let cls = stats.status === 'success' ? 'success' : 'danger';
        document.getElementById('rpa-result-body').innerHTML = `
            <div class="cards">
                <div class="card ${cls}">
                    <div class="card-label">Status</div>
                    <div class="card-value">${App.esc(stats.status)}</div>
                </div>
                <div class="card ${stats.accuracy_pct === 100 ? 'success' : 'warning'}">
                    <div class="card-label">Acurácia</div>
                    <div class="card-value">${stats.accuracy_pct}%</div>
                    <div class="card-detail">${stats.fields_correct}/${stats.fields_total} campos corretos</div>
                </div>
                <div class="card info">
                    <div class="card-label">Duração</div>
                    <div class="card-value">${stats.duration_seconds}s</div>
                </div>
                <div class="card info">
                    <div class="card-label">Registros</div>
                    <div class="card-value">${stats.records_processed}</div>
                    <div class="card-detail">processados</div>
                </div>
            </div>
            ${stats.challenge_message ? `<p style="margin-top:12px;"><span class="badge badge-success">${App.esc(stats.challenge_message)}</span></p>` : ''}
            ${stats.errors && stats.errors.length ? `<div class="alert alert-error" style="margin-top:12px">Erros: ${App.esc(stats.errors.join(', '))}</div>` : ''}
        `;
        document.getElementById('rpa-result-modal').classList.add('active');
    },

    showResultError(msg) {
        document.getElementById('rpa-result-body').innerHTML = `
            <div style="text-align:center;padding:20px 0;">
                <div class="empty-icon" style="font-size:48px;">⚠</div>
                <h3 style="color:var(--danger);margin:12px 0 4px;">Erro na execução</h3>
                <p class="text-muted" style="font-size:13px;line-height:1.6;max-width:400px;margin:0 auto;">${App.esc(msg)}</p>
                <p class="text-muted text-sm" style="margin-top:16px;">Verifique se a planilha foi baixada antes de executar.</p>
            </div>
        `;
        document.getElementById('rpa-result-modal').classList.add('active');
    },

    closeResultModal() {
        document.getElementById('rpa-result-modal').classList.remove('active');
    },

    async reset() {
        const ok = await App.confirm('Tem certeza que deseja limpar todos os registros?', 'Resetar Base');
        if (!ok) return;
        try {
            const res = await API.rpa.reset();
            document.getElementById('rpa-status').textContent = res.message;
            await this.load();
        } catch (e) {
            document.getElementById('rpa-status').textContent = `Erro: ${e.message}`;
        }
    },
};
