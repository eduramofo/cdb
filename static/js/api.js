const API = {
    BASE: '',

    async _fetch(url, opts = {}) {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...opts.headers },
            ...opts,
        });
        if (!res.ok) {
            const text = await res.text();
            let msg;
            try { msg = JSON.parse(text).detail || text; } catch { msg = text; }
            throw new Error(msg);
        }
        return res.json();
    },

    _post(url, body) {
        return this._fetch(url, { method: 'POST', body: JSON.stringify(body) });
    },

    // Health
    health() { return this._fetch('/health'); },

    // RPA
    rpa: {
        downloadSheet() { return API._post('/api/v1/rpa/download-sheet'); },
        getRecords() { return API._fetch('/api/v1/rpa/records'); },
        reset() { return API._post('/api/v1/rpa/reset'); },
        run(headed = false) {
            const qs = headed ? '?headed=true' : '';
            return API._post('/api/v1/rpa/run' + qs);
        },
    },

    // HN
    hn: {
        load(limit) {
            const qs = limit ? `?limit=${limit}` : '';
            return API._post('/api/v1/hn/load' + qs);
        },
        getItems(limit = 100, offset = 0) {
            return API._fetch(`/api/v1/hn/items?limit=${limit}&offset=${offset}`);
        },
        status() { return API._fetch('/api/v1/hn/status'); },
    },

    // Artifacts
    artifacts: {
        list() { return API._fetch('/api/v1/artifacts'); },
    },

    // Docs
    docs: {
        async listDir(path = '') {
            const full = path ? `/docs-files/${path}` : '/docs-files';
            const res = await fetch(full);
            if (!res.ok) throw new Error('Failed to load docs tree');
            const html = await res.text();
            return html;
        },
        async getFile(path) {
            const res = await fetch(`/docs-files/${path}`);
            if (!res.ok) throw new Error('Failed to load doc');
            return res.text();
        },
    },
};
