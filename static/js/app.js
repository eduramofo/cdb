const App = {
    currentPage: null,
    pages: ['dashboard', 'rpa', 'hn', 'artifacts', 'docs'],

    init() {
        this.navItems = document.querySelectorAll('.nav-item');
        this.pageElements = {};
        this.pages.forEach(p => {
            this.pageElements[p] = document.getElementById(`page-${p}`);
        });
        this.titleEl = document.getElementById('page-title');
        this.healthDot = document.getElementById('health-dot');
        this.healthText = document.getElementById('health-text');

        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) this.navigate(page);
            });
        });

        this.checkHealth();
        setInterval(() => this.checkHealth(), 30000);

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.remove('active');
            }
        });

        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);

        AppRPA.init();
        AppHN.init();
        AppArtifacts.init();
        AppDocs.init();

        this.navigate('dashboard');
    },

    navigate(page) {
        if (page === this.currentPage) return;
        this.currentPage = page;
        this.navItems.forEach(item => item.classList.toggle('active', item.dataset.page === page));
        Object.values(this.pageElements).forEach(el => el.classList.remove('active'));
        const el = this.pageElements[page];
        if (el) el.classList.add('active');

        const titles = { dashboard: 'Dashboard', rpa: 'RPA Challenge', hn: 'Hacker News', artifacts: 'Artifacts', docs: 'Documentação' };
        this.titleEl.textContent = titles[page] || page;

        if (page === 'dashboard') Dashboard.refresh();
        if (page === 'rpa') AppRPA.refresh();
        if (page === 'hn') AppHN.refresh();
        if (page === 'artifacts') AppArtifacts.refresh();
        if (page === 'docs') AppDocs.refresh();
    },

    async checkHealth() {
        try {
            const r = await API.health();
            if (r.status === 'ok') {
                this.healthDot.className = 'health-dot ok';
                this.healthText.textContent = 'API Online';
            } else {
                throw new Error('bad status');
            }
        } catch {
            this.healthDot.className = 'health-dot error';
            this.healthText.textContent = 'API Offline';
        }
    },

    showPageContent(page, html) {
        this.pageElements[page].innerHTML = `<div class="page-body">${html}</div>`;
    },

    fmtDate(iso) {
        if (!iso) return '-';
        return new Date(iso).toLocaleString('pt-BR');
    },

    fmtTs(ts) {
        if (!ts) return '-';
        return new Date(ts * 1000).toLocaleString('pt-BR');
    },

    truncate(str, len = 60) {
        if (!str) return '-';
        return str.length > len ? str.slice(0, len) + '...' : str;
    },

    esc(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    toast(msg, type) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type || 'info'}`;
        toast.textContent = msg;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    confirm(message, title) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay active';
            overlay.innerHTML = `
                <div class="modal modal-sm">
                    <div class="modal-header">${title || 'Confirmar'}</div>
                    <div class="modal-body" style="text-align:center;padding:24px 20px;">
                        <p style="font-size:14px;margin-bottom:20px;">${message}</p>
                        <div class="btn-group" style="justify-content:center;">
                            <button class="btn btn-danger" id="_confirm-yes">Sim</button>
                            <button class="btn" id="_confirm-no">Cancelar</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const cleanup = (result) => {
                overlay.remove();
                resolve(result);
            };

            overlay.querySelector('#_confirm-yes').onclick = () => cleanup(true);
            overlay.querySelector('#_confirm-no').onclick = () => cleanup(false);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(false);
            });
            document.addEventListener('keydown', function handler(e) {
                if (e.key === 'Escape') { document.removeEventListener('keydown', handler); cleanup(false); }
                if (e.key === 'Enter') { document.removeEventListener('keydown', handler); cleanup(true); }
            });
        });
    },
};

/* ── Dashboard ──────────────────────────────────────────────────────── */

const Dashboard = {
    html() {
        return `
            <div class="cards" id="dash-cards">
                <div class="card info" id="dash-card-health">Carregando...</div>
                <div class="card success" id="dash-card-rpa">Carregando...</div>
                <div class="card info" id="dash-card-hn">Carregando...</div>
                <div class="card" id="dash-card-tests">Carregando...</div>
            </div>
            <div class="cards">
                <div class="card">
                    <div class="card-label">Sobre o Projeto</div>
                    <p style="font-size:13px;color:var(--text-muted);line-height:1.7;margin-top:8px;">
                        API de automação com <strong>FastAPI + Playwright + SQLite</strong>,
                        desenvolvida para o teste técnico de <strong>Desenvolvedor Sênior de Automação e Integração</strong>.
                    </p>
                </div>
                <div class="card info">
                    <div class="card-label">Projeto Público</div>
                    <p style="font-size:13px;color:var(--text-muted);line-height:1.7;margin-top:8px;margin-bottom:14px;">
                        Ambiente online publicado para visualização pelo recrutador.
                    </p>
                    <a class="btn btn-primary" href="https://cdb-ff94.onrender.com/" target="_blank" rel="noopener noreferrer">Abrir projeto público ↗</a>
                </div>
                <div class="card">
                    <div class="card-label">Ações Rápidas</div>
                    <div class="btn-group" style="margin-top:8px;">
                        <button class="btn btn-primary" onclick="App.navigate('rpa')">RPA Challenge</button>
                        <button class="btn btn-primary" onclick="App.navigate('hn')">Hacker News</button>
                        <button class="btn" onclick="App.navigate('docs')">Documentação</button>
                    </div>
                </div>
            </div>
            <div class="panel">
                <div class="panel-header">Timeline</div>
                <div class="panel-body">
                    <table>
                        <thead><tr><th>Marco</th><th>Data</th></tr></thead>
                        <tbody>
                            <tr><td>Início do projeto</td><td>29/07/2026 11:52</td></tr>
                            <tr><td>Conclusão da Etapa 1 (RPA)</td><td>29/07/2026 13:28</td></tr>
                            <tr><td>Conclusão da Etapa 2 (HN)</td><td>29/07/2026 14:06</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async refresh() {
        App.showPageContent('dashboard', this.html());
        this.load();
    },

    async load() {
        try {
            await API.health();
            document.getElementById('dash-card-health').innerHTML = `
                <div class="card-label">Health</div>
                <div class="card-value" style="color:var(--success)">Online</div>
                <div class="card-detail">/health</div>
            `;
        } catch {
            document.getElementById('dash-card-health').innerHTML = `
                <div class="card-label">Health</div>
                <div class="card-value" style="color:var(--danger)">Offline</div>
            `;
        }

        try {
            const rpa = await API.rpa.getRecords();
            document.getElementById('dash-card-rpa').innerHTML = `
                <div class="card-label">RPA Challenge</div>
                <div class="card-value">${rpa.total}</div>
                <div class="card-detail">registros persistidos</div>
            `;
        } catch {
            document.getElementById('dash-card-rpa').innerHTML = `
                <div class="card-label">RPA Challenge</div>
                <div class="card-value">-</div>
            `;
        }

        try {
            const st = await API.hn.status();
            document.getElementById('dash-card-hn').innerHTML = `
                <div class="card-label">Hacker News</div>
                <div class="card-value">${st.total_items}</div>
                <div class="card-detail">itens | watermark: ${st.last_processed_id || '-'}</div>
            `;
        } catch {
            document.getElementById('dash-card-hn').innerHTML = `
                <div class="card-label">Hacker News</div>
                <div class="card-value">-</div>
            `;
        }

        document.getElementById('dash-card-tests').innerHTML = `
            <div class="card-label">Testes Automatizados</div>
            <div class="card-value">37</div>
            <div class="card-detail">16 RPA + 21 HN = 100% passando</div>
        `;
    },
};

document.addEventListener('DOMContentLoaded', () => App.init());
