var Request = require('request');

module.exports = cloudMailApi;

function cloudMailApi() {
	this._login = '';
	this._password = '';
	this._tokens = {};
	this._params = {};
	this._useragent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36';
	this._jar = Request.jar();
	this.request = Request.defaults({"jar": this._jar, "timeout": 50000, "gzip": true});

	this.upload._write = function(chunk, encoding, done) {
		console.log(chunk.toString());
		done();
	}

}

cloudMailApi.prototype.setCookies = function(cookies) {
	var self = this;
	cookies.forEach(function(cookie) {
		self._jar.setCookie(Request.cookie(cookie), "https://cloud.mail.ru/");
	});
};

cloudMailApi.prototype.login = function(login, password, callback) {
	this._login = login;
	this._password = password;

	this.request.post({
		uri: 'http://auth.mail.ru/cgi-bin/auth?lang=ru_RU&from=authpopup',
		form: {
			page : "https://cloud.mail.ru/?from=promo",
			FailPage : "",
			Domain : "mail.ru",
			Login : this._login,
			Password : this._password,
			new_auth_form : "1"
		}
	}, (err, response, body) => {
		if(response.headers.location.indexOf('fail') > -1) {
			callback(new Error('Login error'));
			return;
		}

		this._getAuthData(callback);

	});
}

cloudMailApi.prototype.getDirectory = function(name, callback) {
	name = name.replace(/\//g,'%2F');

	var url = 'https://cloud.mail.ru/api/v2/folder?sort={%22type%22%3A%22name%22%2C%22order%22%3A%22asc%22}&offset=0&limit=500&home='+name+'&api=2&build='+this._params.build+'&x-page-id='+this._params.x_page_id+'&email='+this._login+'&x-email='+this._login+'&token='+this._tokens.csrf+'&_=1433249148810';
	this.request.get({
		uri: url,
		headers: {'User-Agent' : this._useragent}
	}, (err,response,body) => {
		body = JSON.parse(body);
		callback(body);
	});
}

cloudMailApi.prototype.addDirectory = function(name, callback) {
	name = name.replace(/\//g,'%2F');

	var url = 'https://cloud.mail.ru/api/v2/folder/add?home='+name+'&conflict=rename&api=2&build='+this._params.build+'&x-page-id='+this._params.x_page_id+'&email='+this._login+'&x-email='+this._login+'&token='+this._tokens.csrf;
	
	this.request.get({
		uri: url,
		headers: {'User-Agent' : this._useragent}
	}, (err,response,body) => {
		body = JSON.parse(body);
		callback(body);
	});
}

cloudMailApi.prototype.upload = function(file, path, callback) {
	var self = this;
	var url = this._params.uploadUrl+'?cloud_domain=2&x-email='+this._login+'&fileapi'+Date.now();
	this.request({
		'method': 'POST',
		'url': url,
		'formData':	{
			'_file' : 'file',
			'file': file
		}
	}, function (err, httpResponse, body)
	{
		self._addFile(body.trim().split(';'), path, callback);
	});
}

cloudMailApi.prototype.publish = function(path, callback) {
	this.request.post({
		uri: 'https://cloud.mail.ru/api/v2/file/publish',
		headers: {'User-Agent' : this._useragent},
		form: {
			home: path,
			api: 2,
			build: this._params.build,
			'x-page-id': this._params.x_page_id,
			email: this._login,
			'x-email': this._login,
			token: this._tokens.csrf
		}
	}, (err, response, body) => {
		if(typeof callback == 'function')
			callback(JSON.parse(body));
	});
}

cloudMailApi.prototype.remove = function(path, callback) {
	this.request.post({
		uri: 'https://cloud.mail.ru/api/v2/file/remove',
		headers: {'User-Agent' : this._useragent},
		form: {
			home: path,
			api: 2,
			build: this._params.build,
			'x-page-id': this._params.x_page_id,
			email: this._login,
			'x-email': this._login,
			token: this._tokens.csrf
		}
	}, (err, response, body) => {
		if(typeof callback == 'function')
			callback(JSON.parse(body));
	});
}

cloudMailApi.prototype.getDirectLink = function(path, callback) {
	var url = 'https://cloud.mail.ru/public/'+path;

	this.request.get({
		uri: url,
		headers: {'User-Agent' : this._useragent}
	}, (err, response, body) => {
		var data = body.match(/\<script\>window\[\"\_\_configObject\_\_(.*?)\"\] \=(.*?)\;\<\/script\>/)[2];
		data = data.replace(/"ITEM_NAME_INVALID_CHARACTERS":"[^,]+",/,'');
		data = JSON.parse(data);
		var weblink = data.dispatcher.weblink_view[0].url;
		var token = data.tokens.download;

		callback(weblink+path+'?key='+token);
	});
}

cloudMailApi.prototype._addFile = function(data, path, callback) {
	this.request.post({
		uri: 'https://cloud.mail.ru/api/v2/file/add',
		headers: {'User-Agent' : this._useragent},
		form: {
			home: path,
			hash: data[0],
			size: data[1],
			conflict: 'rename',
			api: 2,
			build: this._params.build,
			'x-page-id': this._params.x_page_id,
			email: this._login,
			'x-email': this._login,
			token: this._tokens.csrf
		}
	}, (err, response, body) => {
		if(typeof callback == 'function')
			callback(JSON.parse(body));
	});
}

cloudMailApi.prototype._getAuthData = function(callback) {
	var self = this;
	this.request.get({
		uri: 'https://cloud.mail.ru/?from=promo&from=authpopup',
		headers: {'User-Agent' : this._useragent}
	}, (err, response, body) => {
		var data = body.match(/\<script\>window\[\"\_\_configObject\_\_(.*?)\"\] \=(.*?)\;\<\/script\>/)[2];
		data = data.replace(/"ITEM_NAME_INVALID_CHARACTERS":"[^,]+",/,'');
		data = JSON.parse(data);
		self._tokens = data.tokens;
		self._params.x_page_id = data.params['x-page-id'];
		self._params.build = data.params['BUILD'];
		self._params.uploadUrl = data.dispatcher.upload[0]['url'];
		callback();
	});
}