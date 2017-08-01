let {Client} = require('../dubbo-node-async-await')

	
, client = exports.client = new Client({'level': 'debug'})


let exeUserService = async (method, body) => {
	return await client.execute('example.service.UserService', method, body);
}

exports.userService = {
	getById : async body => {
		return await exeUserService('getById', body)
	}
}


