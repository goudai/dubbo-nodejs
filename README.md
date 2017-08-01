# nodejs 包装直接调用dubbo exported service

## 用法
### co
```js

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

```

async/await

```js
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

```