import Api from './Api';

let _method = 'GET';

const Wc = {
    async get(endpoint, options) {
        _method = 'GET';
        let res = await Api.get(endpoint, options);
        if (!res) return {};
        let data;
        try { data = await res.json(); }
        catch (e) { data = {}; }

        return await this.assert(data, 'GET');
    },
    async post(endpoint, options) {
        _method = 'POST';
        let res = await Api.post(endpoint, options);
        if (!res) return {};
        let data;
        try { data = await res.json(); }
        catch (e) { data = {}; }
        
        return await this.assert(data, 'POST');
    },
    async put(endpoint, options) {
        _method = 'PUT';
        let res = await Api.put(endpoint, options);
        if (!res) return {};
        let data;
        try { data = await res.json(); }
        catch (e) { data = {}; }
        
        return await this.assert(data, 'PUT');
    },
    async assert(data, _method) {
        if (data.fallback) {
            try {
                data = await new Promise((resolve, reject) => {
                    var xhttp = new XMLHttpRequest();
                    xhttp.onreadystatechange = function() {
                        if (this.readyState == 4 && this.status != 200) resolve(null);
                        if (this.readyState == 4 && this.status == 200) {
                            resolve(JSON.parse(this.responseText));
                        }
                    };
                    xhttp.open(data.fallback.method, data.fallback.url, true);
                    _method != 'GET'? xhttp.setRequestHeader('Content-type', 'application/json'):null;
                    _method != 'GET'? xhttp.send(JSON.stringify(data.fallback)):xhttp.send();
                }).catch(e => data = null);
            } catch (e) { data = null; }
        }
        return {data};
    }
};

export default Wc