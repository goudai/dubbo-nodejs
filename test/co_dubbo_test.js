let co = require('co');
let {userService,client} = require('./DubboNodeServiceYield');

var print = function (log) {
	console.log(log)
}

co(function *() {
	try {
		var result = yield userService.getById({"id":1});
		print(result)
		client.close()
	}catch (e){x
		console.log(e)
		client.close()
	}finally {
		console.log(userService);
	}
	
})

