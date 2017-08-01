/*
 import 
 "babel-core": "^6.10.4",
 "babel-preset-es2015": "^6.9.0",
 "babel-preset-stage-3": "^6.11.0"

 */

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

	getService(service,isNotify) {
		var self = this;
		return new Promise((resolve, reject)=> {
			if(!isNotify){
				if (!service)
					reject(new Error('[Dubbo Client getService method] : service must be not null'))
				let v = serviceMap.get(service)
				if (v) {
					this.log.debug('[Dubbo Client getService method]: get service[' + service + '] provider  from cache')
					resolve(this.selectProvider(service))
					return;
				}
			}

			self.getZookeeper()
				.then(client=> {
					client.getChildren('/dubbo/' + service + '/providers',
						(event)=> {
							self.log.debug('[Dubbo Client getService method]:  zookeeper notify service [' + service + '] provider')
							self.getService(service,true)
						},

						(err, children) => {
							if (err) {
								if (err.name === 'NO_NODE') {
									reject(new JavaError('[Dubbo Client getService method]: service [' + service + '] ,not found provider'))
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
								self.log.debug('[Dubbo Client getService method]:Received service[' + service + '] provider list : ' + result)
								serviceMap.set(service, result)
								resolve(this.selectProvider(service))
							}
							else {
								reject(new JavaError('[Dubbo Client getService method]: 尚未发现服务提供者 [' + service + ']'))
							}
						})
				})
		});
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

	async execute(service, method, body) {
		var url = await this.getService(service)
		if(url == Error){
			return url;
		}
		let srcUrl = url + '?service=' + service + '&method=' + method;
		this.log.debug("[Dubbo Client execute method]: send request to url  : " + srcUrl)
		var res = await  fetch(srcUrl, {
			method: 'POST'
			, body: JSON.stringify(body)
			, headers: {
				'Accept': 'application/json'
				, 'Content-Type': 'application/json'
				, 'connection': 'keep-alive'
				, 'content-length': JSON.stringify(body).length
			}
			, compress: true
			, timeout: 1000
		})
		this.log.debug("[Dubbo Client execute method]:  Received raw response [%s]", JSON.stringify(res))
		var json = await res.json()
		this.log.debug("[Dubbo Client execute method]:  Received json data response [%s] request [%s] ", JSON.stringify(json), srcUrl)
		if (json.success)
			return json

		throw new JavaError(json.error, json.errorType);
	}


	close() {
		this.zookeeper.close()
	}

}


exports.Client = Client
