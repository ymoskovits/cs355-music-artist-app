const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');


const server_address = 'localhost';
const port = 3000;

let html_stream = fs.createReadStream('./html/search-form.html', 'utf8');

let server = http.createServer((req,res)=>{
	console.log(`A new request was made from ${req.connection.remoteAddress} for ${req.url}`);
	let ext = req.url;
	if(ext === "/"){
		res.writeHead(200,{'Content-Type':'text/html'});
		html_stream.pipe(res);
		// res.end("GOT 1");
	}
	else if(ext.includes("/favicon.ico")){
		console.log("favicon case");
		res.writeHead(404);
		res.end();
	}

	//Error checking could be done better here.
	//404 can be sent thru an .on('error')
	else if(ext.includes("/artists")){
		if(!fs.existsSync('.' + req.url)){
			res.writeHead(404);
			return res.end();
		}
		let parsed_url = req.url.split("/");
		let image_name = parsed_url[2];
		console.log(image_name);

		html_stream.on('error', err => {
			console.log(err);
			console.log('made it');
			res.writeHead(404);
			return res.end();
		});
		fs.readFile('.' + req.url, (err, data) => {
			if(err){
				throw err;
			}
			res.writeHead(200, {'Content-Type' : 'image/jpeg'});
			res.write(data);
		});
		// if(fs.existsSync('.' + req.url)){
		// 	res.writeHead(200,{'Content-Type':'image/jpeg'});

		// 	console.log("exists");
		// }
		// else{

		// }
		// res.end("GOT artists");
	}
	else if(ext.includes("/search")){
		let parsed_url = url.parse(req.url ,true);
		console.log(parsed_url);
		const credentials_json = fs.readFileSync('./auth/credentials.json', 'utf8');
		const credentials = JSON.parse(credentials_json);
		const post_data = {
			"client_id" : credentials['client_id'],
			"client_secret" : credentials["client_secret"],
			"grant_type" : "client_credentials"
		};
		let stringified_post_data = querystring.stringify(post_data);

		const options = {
			hostname: 'https://accounts.spotify.com/api/token',
			method: 'POST',
			headers: {
				'Content-Type' : 'application/x-www-form-urlencoded',
				'Content-Length' : stringified_post_data.length
			}
		};

		let request_sent_time = new Date();
		let authentication_req = https.request(options, authentication_res => {
			recieved_authentication(authentication_res, res, user_input, request_sent_time);
		});
		authentication_req.on('error', err => {
			console.error(err);
		});
		authentication_req.write(stringified_post_data);
		console.log("requesting token");
		authentication_req.end();
		//res.end("A SERACH");
	}
	else{
		res.writeHead(404);
		res.end();

	}
	// res.writeHead(200,{'Content-Type':'text/html'});
	// console.log(req.url);
	// num.pipe(res);

});

console.log('Now listening on port ' + port);

server.listen(port,server_address);



function recieved_authentication(authentication_res, res, user_input, request_sent_time){
	authentication_res.setEncoding("utf8");
	let body = "";
	authentication_res.on("data", data => {body += data;});
	authentication_res.on("end", () => {
		let authentication_res_data = JSON.parse(body);
		create_cache(authentication_res_data);
		create_search_req(authentication_res_data, res, user_input, request_sent_time);
	});
}












// const http = require('http');
// const fs = require('fs');

// const server_address = 'localhost';
// const port = 3000;

// let html_stream = fs.createReadStream('./assets/index.html','utf8');

// let server = http.createServer((req,res)=>{
// 	console.log(`A new request was made from ${req.connection.remoteAddress} for ${req.url}`);
// 	res.writeHead(200,{'Content-Type':'text/html'});
// 	html_stream.pipe(res);
// });

// console.log('Now listening on port ' + port);
// server.listen(port,server_address);



























