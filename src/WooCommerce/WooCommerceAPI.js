/*
 * WooCommerce API
 * DO NOT TOUCH!
 * 
 * Scratch that, feel free to touch. I had a lot of touching to do to get this little sumbich to work
 * you just might have a heckuva lot to do to make it fit your peculiar case
 */
'use strict';

const crypto = require('crypto'); // De-paule
const fetch = require('node-fetch') // De-paule
import OAuth from 'oauth-1.0a';
// import {warn} from '@app/Omni'

export default WooCommerceAPI;

function WooCommerceAPI(opt) {
  if (!(this instanceof WooCommerceAPI)) {
    return new WooCommerceAPI(opt);
  }

  opt = opt || {};

  if (!(opt.url)) {
    throw new Error('url is required');
  }
  if (!(opt.consumerKey)) {
    throw new Error('consumerKey is required');
  }
  if (!(opt.consumerSecret)) {
    throw new Error('consumerSecret is required');
  }

  // this.classVersion = '1.0.0';
  this._setDefaultsOptions(opt);
}

WooCommerceAPI.prototype._setDefaultsOptions = function (opt) {
  this.url = opt.url;
  this.wpAPI = opt.wpAPI || false;
  this.wpAPIPrefix = opt.wpAPIPrefix || 'wp-json';
  this.version = opt.version || 'v3';
  this.isSsl = /^https/i.test(this.url);
  this.consumerKey = opt.consumerKey;
  this.consumerSecret = opt.consumerSecret;
  this.verifySsl = opt.verifySsl;
  this.encoding = opt.encoding || 'utf8';
  this.queryStringAuth = opt.queryStringAuth || true;
  this.port = opt.port || '';
  this.timeout = opt.timeout || 0;
};

WooCommerceAPI.prototype._normalizeQueryString = function (url) {
  // Exit if don't find query string
  if (-1 === url.indexOf('?')) return url;

  // let query       = _url.parse(url, true).query;
  let query = url;
  let params = [];
  let queryString = '';

  for (let p in query) params.push(p);
  params.sort();

  for (let i in params) {
    if (queryString.length) queryString += '&';

    queryString += encodeURIComponent(params[i]).replace('%5B', '[').replace('%5D', ']');
    queryString += '=';
    queryString += encodeURIComponent(query[params[i]]);
  }

  return url.split('?')[0] + '?' + queryString;
};

WooCommerceAPI.prototype._getUrl = function (endpoint) {
  let url = '/' === this.url.slice(-1) ? this.url : this.url + '/';
  let api = this.wpAPI ? this.wpAPIPrefix + '/' : 'wp-json/';

  url = url + api + this.version + '/' + endpoint;

  // Include port.
  if ('' !== this.port) {
    let hostname = url; //_url.parse(url, true).hostname;
    url = url.replace(hostname, hostname + ':' + this.port);
  }

  if (!this.isSsl)
    return this._normalizeQueryString(url);

  return url;
};

WooCommerceAPI.prototype._getOAuth = function () {
  let data = {
    consumer: {
      key: this.consumerKey,
      secret: this.consumerSecret
    },
    signature_method: 'HMAC-SHA256',
    // de-paule: I added hash_function, cos it breaks without it
    hash_function(base_string, key) {
      return crypto.createHmac('sha256', key).update(base_string).digest('base64');
    }
  };

  if (-1 < ['v1', 'v2'].indexOf(this.version)) data.last_ampersand = false;

  return new OAuth(data);
};

WooCommerceAPI.prototype.join = function (obj, separator) {
  let arr = [];
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      arr.push(key + '=' + obj[key]);
    }
  }
  return arr.join(separator);
};

WooCommerceAPI.prototype._request = async function (method, endpoint, data) {

  let url = this._getUrl(endpoint);

  let params = {
    url: url,
    method: method,
    encoding: this.encoding,
    timeout: this.timeout,

    /* --------------------------------------------
     * Let's talk about this one line of code, sorry, config
     * I spent an unreasonable amount of time debugging and trying to figure
     * why my innocent POST requests reach the server as 'OPTIONS'...
     * I actually thought I'd beat it, by makin a tweak you'd notice some lines down,
     * this tweak was earlier in this project when my GET requests ended up as OPTIONS
     * too.
     * Long story short, 'cors' seems to be the default mode for fetch() and disabling
     * it made my requests arrive safely.
     * 
     * Oh, and did I mention that the debugging took reading through WooCommerce's source too?
     */
    // mode: 'no-cors',
  };

  if (this.isSsl) {
    if (this.queryStringAuth) {
      params.qs = {
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret,
        ...data
      };
    } else {
      params.auth = {
        user: this.consumerKey,
        pass: this.consumerSecret
      };
    }
    params.strictSSL = this.verifySsl;
  } else {
    if (method == 'GET') {
      params.qs = this._getOAuth().authorize({
        url: url,
        method: method,
        data: data
      });
      // console.log(params.qs)
    } else {
      params.qs = this._getOAuth().authorize({
        url: url,
        method: method,
      });
    }
  }

  // console.log(params.url);
  // encode the oauth_signature to make sure it not remove + charactor
  params.qs.oauth_signature = encodeURIComponent(params.qs.oauth_signature);
  params.url = params.url + '?' + this.join(params.qs, '&');

  // warn(params)

  if (method == 'GET') {
    params.headers = {
      'Cache-Control': 'no-cache'
    };
  } else if (method == 'POST') {
    params.headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    params.body = JSON.stringify(data);
  }
  
  try {
    // bad things happen when params follow GET, like turning to OPTIONS midway and ultimately failing
    data = method == 'GET'? await fetch(params.url):await fetch(params.url, params);
  } catch (e) {
    // we'll still leave this, fallback things
    if (e.code) return
    data = new Response(JSON.stringify({fallback: params}))
  }
  return data;
};

WooCommerceAPI.prototype.get = async function (endpoint, data, callback) {
  return await this._request('GET', endpoint, data, callback);
};

WooCommerceAPI.prototype.post = async function (endpoint, data, callback) {
  return await this._request('POST', endpoint, data, callback);
};

WooCommerceAPI.prototype.put = async function (endpoint, data, callback) {
  return await this._request('PUT', endpoint, data, callback);
};

WooCommerceAPI.prototype.delete = async function (endpoint, callback) {
  return await this._request('DELETE', endpoint, null, callback);
};

WooCommerceAPI.prototype.options = async function (endpoint, callback) {
  return await this._request('OPTIONS', endpoint, null, callback);
};