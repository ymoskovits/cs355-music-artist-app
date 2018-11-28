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
			res.end();
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
			"client_secret" : credentials['client_secret'],
			"grant_type" : 'client_credentials'
		};

		let stringified_post_data = querystring.stringify(post_data);
		// let hexString = credentials['client_id']+ ':' + credentials['client_secret'];
		hexString = stringified_post_data;
		let base64String = Buffer.from(hexString, 'hex').toString('base64')
		console.log("BASE 64 String : " + base64String);

		let authOptions = {
		  url: 'https://accounts.spotify.com/api/token',
		  headers: {
		  	'Content-Type' : 'application/x-www-form-urlencoded',
		    'Authorization': base64String,
		    'grant_type' : 'client_credentials'
		  },
		  form: {
		    grant_type: 'client_credentials'
		  },
		  method: 'POST',
		  json: true
		};

		// const options = {
		// 	protocol: 'https:',
		// 	hostname: 'accounts.spotify.com/api/token',
		// 	method: 'POST',
		// 	grant_type: "client_credentials",
		// 	headers: {
		// 		'Content-Type' : 'application/x-www-form-urlencoded',
		// 		'Content-Length' : stringified_post_data.length,
		// 		'Authorization' : b64encoded
		// 	}
		// };
		let cache_valid = false;
		let user_input = parsed_url;

		if(fs.existsSync('./auth/authentication_res.json')){
			let content = fs.readFileSync('./auth/authentication_res.json', 'utf8');
			let cached_auth = JSON.parse(content);
			if(new Date(cached_auth.expiration) > Date.now()){
				console.log("Token Valid");
				cache_valid = true;
				create_search_req(cached_auth, res, user_input);
			}
			else{
				console.log("Token Expired");
			}
		}
		if(cache_valid){
			
		}
		else{
			let request_sent_time = new Date();
			let user_input = parsed_url;
			let authentication_req = https.request('https://accounts.spotify.com/api/token', authOptions, authentication_res => {
				recieved_authentication(authentication_res, res, user_input, request_sent_time);
			});
			authentication_req.on('error', err => {
				console.log("IN\nside\nerror\nfunction");
				console.error(err);
			});
			authentication_req.write(stringified_post_data);
			console.log("requesting token");
			authentication_req.end();
		}


		
		res.end("A SERACH");
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
				console.log(request_sent_time);

		authentication_res_data.expiration = request_sent_time;
		authentication_res_data.expiration.setHours(authentication_res_data.expiration.getHours() + 1);
		console.log(authentication_res_data);

		console.log(body);
		create_cache(authentication_res_data);
		create_search_req(authentication_res_data, res, user_input, request_sent_time);
	});
}

function create_cache(authentication_res_data){
	fs.writeFile('./auth/authentication_res.json', JSON.stringify(authentication_res_data), err => {
		if (err) throw err;
		console.log("Authentication Cached");
	});
}

function create_search_req(authentication_res_data, res, user_input, request_sent_time){
	let query = {
		q: user_input.query['artist'],
		type: 'artist'
	}
	console.log("Creatign search request");
	console.log(user_input);
	console.log(authentication_res_data);


	let options = {
		// url : 'api.spotify.com', ///v1/search?' + querystring.stringify(query),
		headers: {
			// 'Content-Type' : 'application/x-www-form-urlencoded',
			'Authorization' : 'Bearer ' + authentication_res_data.access_token.toString(),
			'Accept' : "application/json",
			'Content-Type' : "application/json"
		},
		path: '/v1/search?' + querystring.stringify(query),

		host: 'api.spotify.com'
	};
	console.log(options);
	
	let url = 'https://api.spotify.com/v1/search?' + querystring.stringify(query); //querystring.stringify(user_input);
	console.log(url);
	let search_req = https.get(url, options, artist_data_callback); // (res) => {



// let data = '';
// res.setEncoding('utf8');
// response.on('data', function(d) {
//   data += d
// })
// response.on('end', function(d) {
//   // res.send(data)
// })





	// 	console.log(data);
	// 	console.log("CALLback line 193"); // this should do with the input something
	// });
	// console.log(search_req);
	search_req.on('error', err => {
		console.log("INSIDE ERROR");
		console.log(err);
		console.log("OUTSIDE ERROR");

	});
	// console.log(search_req);
}


function artist_data_callback(res){
	res.setEncoding('utf8');
	let rawData = '';
  	res.on('data', (chunk) => { rawData += chunk; });
  	res.on('end', () => {
	  	try {
	      const parsedData = JSON.parse(rawData);
	      console.log(parsedData);
	    } catch (e) {
	      console.error(e.message);
	    }
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



























