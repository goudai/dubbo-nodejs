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

	getService (service, cb) {
		if (!service)
			cb(new Error('Registry : service must be not null'))
		let v = serviceMap.get(service)
		if (cb && v) {
			this.log.debug('get from cache')
			cb(null, this.selectProvider(service))
			return;
		}
		let _this = this
		this.getZookeeper()
			.then(client=> {
				client.getChildren('/dubbo/' + service + '/providers',
					(event)=> {
						_this.getService(service)
						_this.log.debug('notfiy ...')
					},

					(err, children) => {
						if (err) {
							if (err.name === 'NO_NODE') {
								cb && cb(new Error('Registry : service [' + service + '] ,not found provider'))
							} else {
								_this.log.error('Registry : 订阅失败 [' + service + '] [' + err.toString() + ']')
							}

						}
						else if (children.length > 0) {
							var result = []
							children.forEach(_this => {
								if (_this.startsWith('restful')) {
									result.push('http://' + decodeURIComponent(_this).split('?')[0].split('/')[2])
								}
							})
							_this.log.debug('rec data ' + result)
							serviceMap.set(service, result)
							cb && cb(null, _this.selectProvider(service))
						}
						else {
							cb && cb(new Error('Registry : 尚未发现服务提供者 [' + service + ']'))
						}
					})
			})
	}

	selectProvider(service) {
		let urls = serviceMap.get(service)
		if (urls && urls.length > 0) {
			let number = Math.floor(Math.random() * urls.length)
			return urls[number]
		} else {
			throw new Error('service [' + service + '] no provider')
		}

	}

	execute(service, method, body) {
		var _this = this;
		return new Promise(function (resolve, reject) {
			this.getService(service, (err, url)=> {
				if (err) {
					_this.log.error(JSON.stringify(err))
					reject(err)
					return;
				}

				_this.log.debug("send host : " + url)
				fetch(url + '?service=' + service + '&method=' + method, {
					method: 'POST'
					, body: JSON.stringify(body)
					, headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json'
						, 'connection': 'keep-alive'
						, 'content-length': JSON.stringify(body).length
					}
					, compress: true
					, timeout: 1000
				}).then(res=> {
					console.log(JSON.stringify(res.headers));
					return res.json()
				})
					.then(json=> {
						if (json.success) {
							resolve(json)
						}
						else {
							let javaError = new JavaError(json.error, json.errorType);
							_this.log.error(JSON.stringify(javaError))
							reject(javaError)
						}
					})
					.catch(function (e) {
						console.log(JSON.stringify(e));
						reject(e)
					})


			})
		}.bind(this))

	}

	close() {
		this.zookeeper.close()
	}

}


exports.Client = Client
