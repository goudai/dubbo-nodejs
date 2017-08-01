"use strict"

let {userService,client} = require( './DubboNodeServiceAsyncAwait')

var print = function (log) {
	console.log(log)
}
print(1)

var a = async function () {
	try {
		var result = await userService.getById({"id":1});
		print(result)
		// client.close()
	}catch (e){
		console.log(e)
		// client.close()
	}
}
a()


	


