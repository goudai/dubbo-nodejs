let {Client} = require('./../dubbo-node')
	,client = new Client({'level':'error'})


let exeUserService = (method, body) => {
		return client.execute('example.service.UserService',method,body)
}


exports.userService = {
	getById: body => exeUserService('getById',body)

}

