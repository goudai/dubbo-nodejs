// 'use strict';
let Zookeeper = require('node-zookeeper-client')
	, Log = require('log')
	, fetch = require('node-fetch')
/*<com.user.Service,Set<>>*/
//'example.service.UserService' => Set { 'http://192.168.1.24:8091', 'http://192.168.1.24:8090' }
	, serviceMap = new Map
	, JavaError = function (error, errorType) {
	this.errorType = errorType
	this.error = error
}

require("util").inherits(JavaError, Error)
exports.JavaError = JavaError

class Client {

	constructor({
		zkAdress ='localhost:2181'
		, sessionTimeout= 30 * 1000//超时
		, spinDelay=1 * 1000 //延迟
		, retries = 0 //重试次数
		, level = 'debug'
	}) {
		var self = this

		this.initQueue = []
		this.zkAddress = zkAdress
		this.sessionTimeout = sessionTimeout
		this.spinDelay = spinDelay
		this.retries = retries
		this.log = new Log(level)
		this.zookeeper = Zookeeper.createClient(self.zkAddress, {
			sessionTimeout: self.sessionTimeout, //超时
			spinDelay: self.spinDelay, //延迟
			retries: self.retries//重试次数
		})
		this.zookeeper.once('connected', ()=> {
			this.log.debug('connected  zookeeper server  success')
			this.initQueue.forEach(function (p) {
				p.resolve(this.zookeeper)
			}.bind(this))
		})
		this.zookeeper.connect()
	}

	getZookeeper() {
		const promise = new Promise((resolve, reject)=> {
			if (this.zookeeper)
				resolve(this.zookeeper)
			else
				this.initQueue.push(promise)
		})
		return promise
	}

	getService(service) {
		var self = this;
		return function (cb) {
			if (!service)
				cb(new Error('[Dubbo Client getService method] : service must be not null'))
			let v = serviceMap.get(service)
			if (cb && v) {
				this.log.debug('[Dubbo Client getService method]: get service['+service+'] provider  from cache')
				cb(null, this.selectProvider(service))
				return;
			}
			self.getZookeeper()
				.then(client=> {
					client.getChildren('/dubbo/' + service + '/providers',
						(event)=> {
							self.log.debug('[Dubbo Client getService method]:  zookeeper notify service ['+service+'] provider')
							self.getService(service)
						},

						(err, children) => {
							if (err) {
								if (err.name === 'NO_NODE') {
									cb && cb(new JavaError('[Dubbo Client getService method]: service [' + service + '] ,not found provider'))
								} else {
									self.log.error('Registry : 订阅失败 [' + service + '] [' + err.toString() + ']')
								}

							}
							else if (children.length > 0) {
								let result = []
								children.forEach(_this => {
									if (_this.startsWith('restful')) {
										result.push('http://' + decodeURIComponent(_this).split('?')[0].split('/')[2])
									}
								})
								self.log.debug('[Dubbo Client getService method]:Received service['+service+'] provider list : ' + result)
								serviceMap.set(service, result)
								cb && cb(null, self.selectProvider(service))
							}
							else {
								cb && cb(new JavaError('[Dubbo Client getService method]: 尚未发现服务提供者 [' + service + ']'))
							}
						})
				})
		}
	}

	selectProvider(service) {
		let urls = serviceMap.get(service)
		if (urls && urls.length > 0) {
			let number = Math.floor(Math.random() * urls.length)
			return urls[number]
		} else {
			throw new Error('[Dubbo Client selectProvider method]:  service [' + service + '] no provider')
		}

	}


	close() {
		this.zookeeper.close()
	}

}

Client.prototype.execute = function *(service, method, body) {
	var url = yield this.getService(service)
	let srcUrl = url + '?service=' + service + '&method=' + method;
	this.log.debug("[Dubbo Client execute method]: send request to url  : " + srcUrl)
	var res = yield  fetch(srcUrl, {
		method: 'POST'
		, body: JSON.stringify(body)
		, headers: {
			'Accept': 'application/json'
			, 'Content-Type': 'application/json'
			, 'connection': 'keep-alive'
			, 'content-length': JSON.stringify(body).length
		}
		// , compress: true
		, timeout: 1000
	})
	this.log.debug("[Dubbo Client execute method]:  Received raw response [%s]",JSON.stringify(res))
	var json = yield res.json()
	this.log.debug("[Dubbo Client execute method]:  Received json data response [%s] request [%s] ",JSON.stringify(json),srcUrl)
	if (json.success)
		return json

	throw new JavaError(json.error, json.errorType);
}

exports.Client = Client
