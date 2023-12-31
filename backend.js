import Koa from 'koa'
import Router from 'koa-router';
import fs from 'fs';
import bodyParser from 'koa-bodyparser';
import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import cors from '@koa/cors';
import path from 'path';
import mongoose from 'mongoose';
import { Library, User, PlaylistIndex, SinglePlaylistSchema, UserLibrarySchema } from './model.js';
const key = 'password';

import jwt from 'jsonwebtoken';
import jwtMiddleware from 'koa-jwt';


const app = new Koa();
const router = new Router();

app.use(bodyParser());
app.use(cors());
//app.use(jwtMiddleware({ secret: key }).unless({ path: [/^\/signup/, /^\/login/] }));

router.get('/stream/:track_id', async (ctx) => {
  const trackId = ctx.params.track_id;
  const trackPath = await getTrackPath(trackId);

  if (!fs.existsSync(trackPath)) {
    ctx.throw(404, 'Track not found');
  }

  const stat = fs.statSync(trackPath);
  const fileSize = stat.size;
  const range = ctx.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;

    const chunksize = (end-start)+1;
    const file = fs.createReadStream(trackPath, {start, end});
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/mpeg',
    };

    ctx.status = 206;
    ctx.set(head);
    ctx.body = file;
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'audio/mpeg',
    };
    ctx.set(head);
    ctx.body = fs.createReadStream(trackPath);
  }
});

router.get('/getTrackByOrder', async (ctx) => {
	const album_id = ctx.query.album_id;
	const order = ctx.query.order;

	const Playlist = mongoose.model(album_id, SinglePlaylistSchema);
	const track = await Playlist.findOne({ order: order });

	if (track) {
		const trackInfo = await Library.findOne({ track_id: track.tid });
		if (trackInfo) {
			ctx.status = 200;
	        ctx.body = trackInfo;
		}else{
			ctx.status = 404;
	        ctx.body = 'Track not found in library';
		}
    } else {
        ctx.status = 404;
        ctx.body = 'Track with the order not found in the album';
    }
});

router.get('/getTracksByOrder/:pid', async (ctx) => {
	const pid = ctx.params.pid;
	const Playlist = mongoose.model(pid, SinglePlaylistSchema);
	const tracks = await Playlist.find();

	if (tracks.length>0) {
        const tracks_detail = [];
		for(let i = 0; i<tracks.length; i++){
			const track = await Library.findOne({ track_id: tracks[i].tid });
			if(track){
				tracks_detail.push(track);
			}
		}
		ctx.status = 200;
        ctx.body = tracks_detail;
    } else {
        ctx.status = 404;
        ctx.body = 'No track found';
	}
});

router.get('/album', async (ctx) => {
	const albums = await PlaylistIndex.find({ type: 'album' });
	if (albums.length>0) {
        ctx.status = 200;
        ctx.body = albums;
    } else {
        ctx.status = 404;
        ctx.body = 'No album found';
    }
});

router.get('/album/:pid', async (ctx) => {
	const pid = ctx.params.pid;
	const album = await PlaylistIndex.findOne({ pid: pid });
	if (album) {
		if (album.type == 'album'){
			ctx.status = 200;
			ctx.body = album;
		} else {
			ctx.status = 404;
	        ctx.body = 'Item found is not album type';
		}
    } else {
        ctx.status = 404;
        ctx.body = 'No album found';
    }
});

router.get('/playlist', async (ctx) => {
	const playlists = await PlaylistIndex.find({ type: 'playlist' });
	if (playlists.length>0) {
        ctx.status = 200;
        ctx.body = playlists;
    } else {
        ctx.status = 404;
        ctx.body = 'No playlist found';
    }
});

router.get('/playlist/:pid', async (ctx) => {
	const pid = ctx.params.pid;
	const playlist = await PlaylistIndex.findOne({ pid: pid });
	if (playlist) {
		if (playlist.type == 'playlist'){
			ctx.status = 200;
	        ctx.body = playlist;
		} else {
			ctx.status = 404;
	        ctx.body = 'Item found is not playlist type';
		}
    } else {
        ctx.status = 404;
        ctx.body = 'No playlist found';
    }
});

router.get('/track', async (ctx) => {
	const tracks = await Library.find();
	if (tracks.length>0) {
        ctx.status = 200;
        ctx.body = tracks;
    } else {
        ctx.status = 404;
        ctx.body = 'No track found';
    }
});

router.get('/track/:track_id', async (ctx) => {
	const track_id = ctx.params.track_id;
	const track = await Library.findOne({ track_id: track_id });
	if (track) {
        ctx.status = 200;
        ctx.body = track;
    } else {
        ctx.status = 404;
        ctx.body = 'No track found';
    }
});

router.get('/image/:image', async (ctx) => {
	const filepath = path.join('./Library/cover',ctx.params.image);
	if(!fs.existsSync(filepath)){
		// ctx.throw(404, 'Cover image not found');
		const deault_filepath = path.join('./Library/cover','default_album_image.jpg');
		ctx.set({
			'Content-Length': fs.statSync(deault_filepath).size,
	        'Content-Type': 'image/jpeg',
		});
	    ctx.body = fs.createReadStream(deault_filepath);
		return;
	}
	const stat = fs.statSync(filepath);
  	const fileSize = stat.size;

	const head = {
      'Content-Length': fileSize,
      'Content-Type': 'image/jpeg',
    };
    ctx.set(head);
    ctx.body = fs.createReadStream(filepath);
});

router.post('/login', async ctx => {
    console.log('login request received:',ctx.request.body);
    const { user, secret } = ctx.request.body;
    const userData = await User.findOne({ name: user });

    if (userData) {
      let bytes  = CryptoJS.AES.decrypt(secret, key);
      let originalPassword = bytes.toString(CryptoJS.enc.Utf8);

      if(originalPassword === userData.secret) {
		const token = jwt.sign({ userId: userData.uid }, key, { expiresIn: '1h' });
        ctx.body = {
          "status": 0,
          "msg": "Login Success!",
		  "userInfo": userData,
		  "token": token
        };
      } else {
        ctx.body = {
          "status": 1,
          "msg": "Username or Password error!"
        };
      }
    } else {
      ctx.body = {
        "status": 1,
        "msg": "Username does not exist!"
      };
    }
  });

router.post('/signup', async ctx => {
    const { user, secret } = ctx.request.body;

    const existingUser = await User.findOne({ name: user });

    if(existingUser) {
        ctx.body = { status: 1, msg: "Username already exist!" };
    } else {
        const decryptedPassword = CryptoJS.AES.decrypt(secret, key).toString(CryptoJS.enc.Utf8);
        const newUser = new User({
            name: user,
            secret: decryptedPassword,
			uid: crypto.createHash('md5').update(user).digest('hex').substring(0, 16),
        });

        try {
            await newUser.save();
			const UserLibrary = mongoose.model(newUser.uid, UserLibrarySchema);
            ctx.body = { status: 0, msg: "Signup Success!" };
        } catch(err) {
            ctx.body = { status: 1, msg: err.message };
        }
    }
});

router.put('/playlist', jwtMiddleware({ secret: key }), async ctx => {
	const user = ctx.query.user_id;
	const pid = ctx.query.pid;
	const UserLibrary = mongoose.model(user, UserLibrarySchema);
	const playlist = await PlaylistIndex.findOne({ pid: pid });
	if (playlist) {
		if(await UserLibrary.findOne({ id: pid })){
			ctx.status = 500;
	        ctx.body = 'Playlist/album already exist in User Library';
			return;
		}
		const data = {
			type: playlist.type,
			id: pid,
			added_date: new Date().toISOString().substring(0,10),
		};
		const newUserLibrary = new UserLibrary(data);
		await newUserLibrary.save().then(() => console.log('Playlist/album saved in UserLibrary')).catch(err => console.error('Error:', err));
		ctx.body = { status: 0, msg: "Saved playlist/album in User Library Success" };
    } else {
        ctx.status = 404;
        ctx.body = 'No playlist/album found';
    }
});

router.put('/track', jwtMiddleware({ secret: key }), async ctx => {
	const user = ctx.query.user_id;
	const pid = ctx.query.pid;
	const tid = ctx.query.tid;
	const UserLibrary = mongoose.model(user, UserLibrarySchema);
	const playlist = await PlaylistIndex.findOne({ pid: pid });
	if (playlist) {
		if(await UserLibrary.findOne({ id: pid })){
			const SinglePlaylist = mongoose.model(playlist.pid, SinglePlaylistSchema);
			const track = await SinglePlaylist.findOne({ tid: tid });
			if(!track){
				const new_track = {
			        tid: tid,
					order: playlist.added
			    };
				const NewTrack = new SinglePlaylist(new_track);
				NewTrack.save().then(() => console.log('New track saved in playlist')).catch(err => console.error('Error:', err));
				playlist.added = playlist.added + 1;
				playlist.save().then(() => console.log('Playlist updated')).catch(err => console.error('Error:', err));
				ctx.body = { status: 0, msg: "Saved track in playlist Success" };
			}else{
				ctx.status = 500;
		        ctx.body = 'Track already exist in playlist';
				return;
	        }
		}else{
			ctx.status = 500;
	        ctx.body = 'Playlist does not exist in User Library';
			return;
		}
	} else {
		ctx.status = 404;
        ctx.body = 'No playlist found';
	}
});

router.post('/playlist', jwtMiddleware({ secret: key }), async ctx => {
	const user = ctx.query.user_id;
	const name = ctx.query.name;
	const playlist_id = crypto.createHash('md5').update(user+name).digest('hex').substring(0, 16);

	// Check if collection exists
    const collectionNames = await mongoose.connection.db.listCollections().toArray();
    const collectionExists = collectionNames.some(collection => collection.name === playlist_id);

    if (collectionExists) {
        ctx.body = { status: 1, msg: "Playlist id already exists" };
        return;
    }

	try {
	    // save playlist in PlaylistIndex
		const new_playlist = {
			pid: playlist_id,
			name: name,
			added: 0,
			image: 'No Cover Image',
			type: 'playlist'
		};
		const NewPlaylist = new PlaylistIndex(new_playlist);
		NewPlaylist.save().then(() => console.log('New Playlist created!')).catch(err => console.error('Error:', err));

		// save playlist in UserLibrary
		const UserLibrary = mongoose.model(user, UserLibrarySchema);
		const data = {
			type: 'playlist',
			id: playlist_id,
			added_date: new Date().toISOString().substring(0,10),
		};
		const newUserLibrary = new UserLibrary(data);
		await newUserLibrary.save().then(() => console.log('Playlist saved in UserLibrary')).catch(err => console.error('Error:', err));

		const Playlist = mongoose.model(playlist_id, SinglePlaylistSchema);
		ctx.body = { status: 0, msg: "Saved new playlist in User Library Success" };
	} catch(err) {
		ctx.body = { status: 1, msg: err.message };
	}
});

router.delete('/playlist', jwtMiddleware({ secret: key }), async ctx => {
	const user = ctx.query.user_id;
	const pid = ctx.query.pid;
	const UserLibrary = mongoose.model(user, UserLibrarySchema);
	const playlist = await PlaylistIndex.findOne({ pid: pid });
	if (playlist) {
		if(!await UserLibrary.findOne({ id: pid })){
			ctx.status = 500;
	        ctx.body = 'Playlist/album does not exist in User Library';
			return;
		}
		await UserLibrary.deleteOne({ id: pid }).then(() => {
			console.log('Playlist/album removed from UserLibrary');
		}).catch(err => {
			console.error('Error:', err);
		});
		ctx.body = { status: 0, msg: "Removed playlist/album from User Library successfully" };
	} else {
		ctx.status = 404;
        ctx.body = 'No playlist/album found';
	}
});

router.delete('/track', jwtMiddleware({ secret: key }), async ctx => {
	const user = ctx.query.user_id;
	const pid = ctx.query.pid;
	const tid = ctx.query.tid;
	const UserLibrary = mongoose.model(user, UserLibrarySchema);
	const playlist = await PlaylistIndex.findOne({ pid: pid });
	if (playlist) {
		if(await UserLibrary.findOne({ id: pid })){
			const SinglePlaylist = mongoose.model(playlist.pid, SinglePlaylistSchema);
			const track = await SinglePlaylist.findOne({ tid: tid });
			if(track){
				await SinglePlaylist.deleteOne({ tid: tid }).then(() => {
					console.log('Track removed from playlist of UserLibrary');
				}).catch(err => {
					console.error('Error:', err);
				});
				playlist.added = playlist.added - 1;
				playlist.save().then(() => console.log('Playlist updated')).catch(err => console.error('Error:', err));
				ctx.body = { status: 0, msg: "Removed track from playlist Success" };
			}else{
				ctx.status = 500;
		        ctx.body = 'Track does not exist in playlist';
				return;
	        }
		}else{
			ctx.status = 500;
	        ctx.body = 'Playlist does not exist in User Library';
			return;
		}
	} else {
		ctx.status = 404;
        ctx.body = 'No playlist found';
	}
})

router.get('/user/:user_id', jwtMiddleware({ secret: key }), async ctx => {
	const uid = ctx.params.user_id;
	const UserLibrary = mongoose.model(uid, UserLibrarySchema);
	const playlists = await UserLibrary.find({ type: 'playlist' });
	const albums = await UserLibrary.find({ type: 'album' });
	const result = {
		playlists: [],
		albums: []
	};
	for(let i = 0; i<playlists.length; i++){
		const playlist = await PlaylistIndex.findOne({ pid: playlists[i].id });
		if(playlist){
			result.playlists.push(playlist);
		}
	}
	for(let i = 0; i<albums.length; i++){
		const album = await PlaylistIndex.findOne({ pid: albums[i].id });
		if(album){
			result.albums.push(album);
		}
	}
	ctx.status = 200;
	ctx.body = result;
});

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000, () => {
  console.log('Server is running at http://localhost:3000');
});

async function getTrackPath(trackId) {
    const track = await Library.findOne({ track_id: trackId });

    if (!track) {
        throw new Error(`Track with id ${trackId} not found`);
    }

    return track.file;
}
