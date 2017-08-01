let {Client} = require('./../dubbo-node-yield')

let client = exports.client = new Client({'level': 'debug'})


let exeUserService = function *(method, body) {
	return yield client.execute('example.service.UserService', method, body);
}


exports.userService = {
	getById : function *(body) {
		return yield exeUserService('getById', body)
	}
}


