let
	{userService} = require('./DubboNodeService')
	,fetch = require('node-fetch')
	,Log = require('log')
	,log = new Log(Log.DEBUG)




console.log(process.platform);
//统一处理promise Error
process.on('unhandledRejection', function (err, p) {
	console.error(' reject exception'+ err.stack);
})

process.on('uncaughtException', function(err){
	console.log('got an error: %s', err.message);
	process.exit(1);
});

//kill -s SIGINT [process_id] 
process.on('SIGINT', function () {
	console.log('Got a SIGINT. Goodbye cruel world');
	process.exit(0);
});


for (var i =0;i<1000;i++){
	setTimeout(()=>userService.getById({"id":1})
		.then(res=>{
			log.debug(res)
		})
	,i*1000)
}
