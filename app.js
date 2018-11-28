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

	}
	else if(ext.includes("/search")){
		let parsed_url = url.parse(req.url ,true);
		const credentials_json = fs.readFileSync('./auth/credentials.json', 'utf8');
		const credentials = JSON.parse(credentials_json);
		const post_data = {
			"client_id" : credentials['client_id'],
			"client_secret" : credentials['client_secret'],
			"grant_type" : 'client_credentials'
		};

		let stringified_post_data = querystring.stringify(post_data);
		let base64String = Buffer.from(stringified_post_data, 'hex').toString('base64')

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
	}
	else{
		res.writeHead(404);
		res.end();

	}
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
		headers: {
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
	let search_req = https.get(url, options, (search_res_data) => {
		artist_data_callback(search_res_data, res);
	}); 

	search_req.on('error', err => {
		console.log(err);
	});
}

/*
	Here we get the response from spotify.
	We want to use the url to request the image.
	Store that image and read it back to the user.
*/
function artist_data_callback(search_res_data, res){
	search_res_data.setEncoding('utf8');
	let rawData = '';
  	search_res_data.on('data', (chunk) => { rawData += chunk; });
  	search_res_data.on('end', () => {
	  	try {
	      const parsedData = JSON.parse(rawData);
	      console.log(parsedData);
	      let image_name = parsedData.artists.items[0].name;
	      let image_genres = parsedData.artists.items[0].genres;
	      let image_url = parsedData.artists.items[0].images[0].url;
	      let image_req = https.get(image_url, image_res =>{
	      	store_and_write_image(image_res, image_name, image_genres, res);

	      });
	      console.log(image_url);
	    }
	    catch (e) {
	      console.error(e.message);
	    }
  });
}

function store_and_write_image(image_res, name, genres, res){
	let title = name;
	name = name.replace(/ /g,'').toLowerCase();
	let new_image = fs.createWriteStream('./artists/' + name + '.jpg', {'encoding' : null});
	image_res.pipe(new_image);
	new_image.on('finish', () => {
		let webpage = `<h1> ${title} </h1> <p> ${genres.join()} </p> <img src="./artists/${name}.jpg" /> ` ;
		res.write(webpage);
		res.end();
		console.log("Finishedddddd")
	});

	if(fs.existsSync('./artists/' + name + '.jpg')){
		let image_to_write = fs.readFileSync('./artists/' + name + '.jpg', {'Content-Type' : 'image/jpeg'});
		console.log("EXISTSSSS");
	}
	else{
		console.log("DOESNT EXISTSSSS");
	}	
}
























