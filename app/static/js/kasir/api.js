// app/static/js/kasir/api.js

const API = {
    base: 'http://localhost:5000',
    key: 'kasir-rahasia-ganti-ini',
    
    async call(url, opts = {}) {
        try {
            const res = await fetch(this.base + url, {
                method: opts.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Kasir-Key': this.key,
                    ...opts.headers
                },
                body: opts.body ? JSON.stringify(opts.body) : null
            });
            
            const txt = await res.text();
            
            // Debug
            if (!res.ok) {
                console.error('API Error:', res.status, txt.substring(0, 200));
            }
            
            let data;
            try {
                data = JSON.parse(txt);
            } catch (e) {
                throw new Error('Server error: ' + res.status);
            }
            
            if (!res.ok) {
                throw new Error(data.error || 'Error ' + res.status);
            }
            
            return data;
        } catch (err) {
            console.error('API Failed:', err);
            throw err;
        }
    }
};