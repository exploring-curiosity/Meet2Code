const {setData, getData} = require('./users');

const express=require("express");
const app=express();
const bodyParser=require("body-parser");
const cors=require("cors");
const socket=require("socket.io");
const http=require("http");
const oauth=require('./Routers/oauth');
const room=require('./Routers/room');
const path=require('path');
const session = require("express-session");
const mongoose = require("mongoose");
const Room=require('./Schemas/room');
const User=require('./Schemas/user');
const Contest = require('./Schemas/Contest');
const Question = require('./Schemas/QuestionTestcase');
const { serverEndPoint, clientEndPoint } = require('./config');
const { v4: uuid } = require('uuid');
const cheerio = require("cheerio");
const fs = require("fs");
// const {ExpressPeerServer} = require('peer');

const Document = require("./Schemas/Document")
const Peer = require('./Schemas/peerinfos')
const PORT = process.env.PORT || 9000;

const router = require('./Routers/router');
const cron = require('node-cron');



app.use(router);
app.use(cors({credentials:true, origin:[clientEndPoint]}));
app.options('*', cors());
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json({limit: '50mb'}));   
app.use(express.static(path.join(__dirname,'/public')));

app.use(session({
    resave:true,
    secret:"Failures are the stepping stones of success",
    saveUninitialized:true,
    name:"meet2codeCookie",
    cookie : {
        maxAge: 1000* 60 * 60 *24 * 365,
        secure: false,
    }
}))
app.enable('trust proxy');

let loggedinUserDetails=(req,res,next)=>{
    let loggedin=0;
    let user={};
    if(req.session.loggedin==true){
        loggedin=1;
        user=req.session.user;
    }
    res.locals={user:user,loggedin:loggedin};
    next();
}
app.use(loggedinUserDetails);

let isLoggedin=(req,res,next)=>{
    if(req.session.loggedin)
        next();
    else
    {     
          // res.status(404).json({"log_data":"Not logged in",...res.locals})
          res.status(401);
          return res.redirect(`${clientEndPoint}`);
    }
}

//Check if the user is not already logged in
let notLoggedin=(req,res,next)=>{
    if(req.session.loggedin==undefined || req.session.loggedin==null)
        next();
    else
        res.status(404).json({log_data:"Already logged in",...res.locals})
}
const server = http.createServer(app);
const io = socket(server,{cors: {
    cors: true,
      origins: [clientEndPoint],
      methods: ["GET", "POST"]
    }
});


const defaultValue = ""

io.on('connection',(socket)=>{

    socket.on('screen-socket-join',(room)=>{
        socket.join(room);
        socket.emit('screen-connected');
        socket.on('screen-disconnect',(roomId,peerId)=>{
            socket.broadcast.to(roomId).emit('screen-end',peerId);
            socket.disconnect();
        })
        socket.on('sharing-screen',(roomId,id,SId) =>{
            socket.broadcast.to(roomId).emit('new-screen',id,SId);
        })
    })

    socket.on('audio-toggle-sender', (userId, astatus,roomId) => {
		Peer.updateOne({peerid: userId}, {
			audioStatus: astatus, 
		}, function(err, numberAffected, rawResponse) {
		   //handle it
		})
		socket.broadcast.to(roomId).emit('audio-toggle-receiver', {userId: userId, audioStatus: astatus})
	})

	socket.on('video-toggle-sender', (userId, vstatus,roomId) => {
		Peer.updateOne({peerid: userId}, {
			videoStatus: vstatus, 
		}, function(err, numberAffected, rawResponse) {
		   //handle it
		})
		socket.broadcast.to(roomId).emit('video-toggle-receiver', {userId: userId, videoStatus: vstatus})
	})

	socket.on('peer-track-sender', (roomId)=>{

		Peer.find({roomid: roomId}, {'_id': 0, 'username': 1, 'peerid': 1, 'audioStatus': 1, 'videoStatus': 1})
		.then((mediaRes)=>{

			let res = mediaRes.map((x)=>x.peerid)
			socket.broadcast.to(roomId).emit('peer-track-receiver', res, mediaRes)     
		})
	})

	socket.on('join-room', (uname, room_id, userId, astatus, vstatus) => {
		let roomId = room_id
		socket.join(roomId)
		socket.broadcast.to(roomId).emit('user-connected', userId)
		// peers.push(userId)
		const peer = new Peer({
			username: uname,
			roomid: roomId,
			peerid: userId,
			audioStatus: astatus,
			videoStatus: vstatus
		})
		peer.save()
		.then((res)=>{})
		.catch(err=>console.log(err))

		socket.on('disconnect', () => {

		socket.broadcast.to(roomId).emit('user-disconnected', userId)
		Peer.deleteOne({peerid: userId}, function (err) {
			if (err) return handleError(err);
		})
		// peers.splice( peers.indexOf(userId), 1)

		})
	})

    socket.on('createRoom',async(arg,redirect)=>{
        let roomId=uuid();
        socket.join(`${roomId}`);
        try{
            //Get the details of user who emitted the event
            let user=await User.findById(arg.host);
            if(user['room']!==undefined && user['room']!==null){       //Check if user is already in a room
                let room=await Room.findById(user['room'])
                if(room !== null && room !== undefined)
                {
                    redirect(room.roomId,401)
                    return
                }
            }
            //Create room with the arguments sent along with the newly created roomId
            let room=new Room({
                ...arg,
                roomId:roomId,
            })
            room=await room.save()

            //Update the user info with the new socket id and the room id
            user['room']=room._id
            user['socketId']=socket.id
            await user.save()
            redirect(roomId,200);   //Created Successfully redirect with 200
        }
        catch(e){
            console.log(e)
            redirect(undefined,404)
        }
    })
    //Join an existing room
    socket.on('joinRoom',async(arg,redirect)=>{
        
        try{
            let room=await Room.findOne({roomId: arg.id}) //Get the room details
            
            if(room===undefined || room===null){    //Room doesn't exist
                redirect(undefined,404)
                return
            }
            //Get the details of user who emitted the event
            let user=await User.findById(arg.participant)

            if(user['room']!==undefined && user['room']!==null && String(user['room']) !== String(room._id)){       //Check if user is already in a room and not in the given room
                redirect(room.roomId,401)
                return
            }
            if(room['type']==="private" && room['password']!==arg.password){        //If private and password is not correct
                redirect(undefined, 403);    
                return;           
            }
            if(String(user['room'])!== String(room._id)){                         //If the user doesn't already exist

                room['participants'].push(user._id);
                user['room']=room._id
            }
            //Update user and room details and call client redirect function
            await room.save();          
            await user.save();  
            redirect(room.roomId,200); 
        }
        catch(e){
            console.log(e)
            redirect(undefined,404)
        }
    })
    socket.on('leaveRoom',async(arg,redirect)=>{
        try{
            //Get the details of user who emitted the event
            let user=await User.findById(arg.host);
            let room=await Room.findById(user['room']);
            if(room === undefined || room === null)
            {
                user['room'] = null;
                await user.save();
                redirect("Success",200)
            }

            if(room!==undefined && room!==null){
                //Delete the room if the host has ended the meeting
                io.to(room['roomId']).emit('message',{user:'',text:`${user['login']}, has left`});
                io.to(room['roomId']).emit('userLeft', {user: user});
                if(room['host']==(arg.host)){
                    //Emit an end room event to all participants of the room 
                    // socket.to(room['roomId']).emit('endRoom')
                    await Room.findByIdAndDelete(room._id)
                    await Document.findByIdAndDelete(room['roomId'])
                }
                //Remove the participant from the room
                else{
                    room['participants'].splice(room['participants'].indexOf(user._id),1);
                    await room.save();
                }
                //Remove the room from the user
                io.to(user['room']).emit('message',{user:'',text:`${user.name}, has left`});
                user['room']=undefined
                await user.save()
                redirect("Success",200)
            }
        }
        catch(e){
            console.log(e)
            redirect(undefined,404)
        }
    })

    
    socket.on('closeConnection',arg=>{
        socket.leave(`${arg.room}`)
    })
    
    socket.on('join',async (arg,callback)=>{
        try{
            let room=arg.roomID;
            let name=arg.user.login;
            let userRoom=await Room.findOne({roomId: room}) //Get the room details
            if(userRoom===undefined || userRoom===null){    //Room doesn't exist
                // redirect(undefined,404)
                return
            }
            // const {error,user}= addUser({id:socket.id,name,room});
            // if(error) return callback(error);
            let userlist=await getParticipants(room);
            socket.join(room);
            data=getData(room);
            socket.emit('message',{user:'',text:`${name},welcome to the room ${userRoom['name']}`});
            socket.broadcast.to(room).emit('message',{user:'',text:`${name}, has joined`});
            socket.emit('UserList',userlist);
            socket.broadcast.to(room).emit('userJoined', { room: room, user: arg.user });
            io.to(room).emit('canvas-data',data);
            callback(userRoom['name']);
        }
        catch(e)
        {
            console.log(e)
            redirect(undefined,404)
        }
    });
    socket.on('canvas-data',(data,room)=>{
        setData(room,data);
        io.to(room).emit('canvas-data',data);
    });
    socket.on('sendMessage',(message,id,name,room,callback)=>{
        io.to(room).emit('message',{id:id,user:name,text:message});
        callback();
    })
    socket.on("get-document", async documentId => {
        const document = await findOrCreateDocument(documentId)
        socket.join(documentId)
        if(document !== undefined)
        socket.emit("load-document", document.data)

        socket.on("send-changes", delta => {
            socket.broadcast.to(documentId).emit("receive-changes", delta)
        })

        socket.on("save-document", async data => {
            await Document.findByIdAndUpdate(documentId, { data })
        })
    })

    //Contest related socket listeners and emitter
    socket.on("createContest", async (arg, callback) => {

        let contestId = uuid();
        socket.join(`${contestId}`);
        try{
            //Get the details of user who emitted the event
            //Create room with the arguments sent along with the newly created roomId
            let contest=new Contest({
                contestId : contestId,
                startTime : arg.startTime,
                host : arg.host,
                name :  arg.name,
                questions : arg.questions,
                participants : [
                    {
                        participant : arg.host,
                        score : 0
                    }
                ]
            });
            contest=await contest.save()
            
            //Run a cron job for starting and ending contests
            let job = cron.schedule('* * * * *', async() => {
                let curDateTime = new Date().getTime();
                let startTimeSeconds = new Date(arg.startTime).getTime();
                try
                {
                    if(curDateTime >= startTimeSeconds)
                    {
                        let curContest = await Contest.findById(contest._id);
                        if(curContest['status'] === 'not started')
                        {
                            curContest['status'] = 'running';
                            curContest = await curContest.save();

                            io.to(contestId).emit('contestStarted',{contest: curContest['name'], contestId : curContest['contestId'], contest_db_id : curContest._id});
                        }
                    }
                }
                catch(e)
                {
                    console.log(e)
                }

            });
            job.start();
        }
        catch(e){
            console.log(e);
        }

    })

    socket.on('joinContest', async(arg, redirect)=>{
        
        socket.join(`${arg.contestId}`);    //Join the contest room
        let contest = await Contest.findById(arg.id);
        contest.participants.push({
            participant : arg.user._id,
            score : 0
        });

        contest = await contest.save();
        console.log(contest['status'])
        if(String(contest['status']) === String('running'))
        {
            redirect("running",202);
        }

    })
});

async function getParticipants(roomId){
    try{
        let room=await Room.findOne({roomId: roomId});
        let users=[];
        let user=await User.findById(room['host']);
        users.push(user);
        let participants = room['participants'];
        let i;
        for(i=0;i<participants.length;i++)
        {
            user=await User.findById(participants[i]);
            users.push(user);
        }
        return users;
    }
    catch(e)
    {
        console.log(e)
        return [];
    }
}
async function findOrCreateDocument(id) {
    if (id == null) return
  
    const document = await Document.findById(id)
    if (document) return document
    return await Document.create({ _id: id, data: defaultValue })
}

app.set('socketio',io)

app.use('/oauth',oauth);
app.use('/room',room);

app.get('/getProblem/', async(req, res)=>{
    res.set('Access-Control-Allow-Origin', clientEndPoint);

    let {contest, id} = req.query
    try{
        // let response = await fetch("https://www.codeforces.com/problemset/problem/"+contest+"/"+id);
        // response = await response.text();

        let response =  fs.readFileSync(process.cwd() + "/questionsHtml/" + contest + id + '.html').toString()
        let doc = cheerio.load(response);
        let html = doc('.problem-statement').html();
        res.send(html);
    }
    catch(exception)
    {
        console.log(exception)
        res.json({contest, id})
    }

})

app.get('/codeforces/questions', async(req,res)=>{

    res.set('Access-Control-Allow-Origin', clientEndPoint);
    let {tags} = req.query
    if(tags === undefined)
        tags = "2-sat"

    try{
        let response = await fetch("https://codeforces.com/api/problemset.problems?tags="+tags, {
            method : "get"
        });
        response = await response.json();
        res.json({questions : response})
    }
    catch(exception)
    {
        console.log("Exception", exception)
        res.json({"msg" : "Questions not found"})
    }
});

app.get('/publicRooms', async(req,res) => {
    res.set('Access-Control-Allow-Origin', clientEndPoint);

    const rooms = await Room.find().populate('host').populate('participants');
    let response = []
    for(let room of rooms)
    {
        if(room['type'] === 'public')
        {   
            let curRoom = {
                'size' : room['participants'].length + 1,
                'creationTime' : room['startTime'],
                'name' : room['name'],
                'desc' : room['description'],
                'id'   : room['roomId'],
                'host' : {
                    'imageUrl' : room['host']['imageUrl'],
                    'login' : room['host']['login']
                },
                'participants' : [...room['participants']]
            };
            response.push(curRoom);
        }
    }
    // fetch name, desc, host, creation time, number of participants, profile photos of first four people and link to join the room.
    res.json(response);    

});

app.get('/getContests',async(req,res)=>{
    res.set('Access-Control-Allow-Origin', clientEndPoint);

    try{
        let contests = await Contest.find();
        res.json(contests);
    }
    catch(e)
    {
        console.log(e);
    }

});

app.get('/contestsSize', async(req,res)=>{
    res.set('Access-Control-Allow-Origin', clientEndPoint);
    try{
        let count = await Contest.countDocuments();
        res.json({count})
    }
    catch(e)
    {
        console.log(e);
    }
});

app.get('/questionTestcases', async(req,res)=>{
    res.set('Access-Control-Allow-Origin', clientEndPoint);

    let {contestId, questionId} = req.query
    try{

        let testCases = await Question.findOne({contestId : contestId, questionId : questionId});
        res.json(testCases['testCases']);
    }
  catch(e)
    {
        console.log(e);
    }

})


app.get('/contest/:id', async(req,res) => {
    res.set('Access-Control-Allow-Origin', clientEndPoint);

    let contestId = req.params.id
    try{
        let contest = await Contest.findOne({contestId : contestId});
        res.json(contest);
    }

    catch(e)
    {
        console.log(e);
    }

});

app.post('/addScore/contest', async(req,res)=>{

    let contestId = req.body.contestId;
    let contest = await Contest.findOne({contestId : contestId});
    let user = await User.findById(req.body.userId);

    for(let participant of contest['participants'])
    {
        if(String(participant['participant']) === String(req.body.userId))
        {   
            let to_add = Number(req.body.problemNumber) * 10;
            participant['score'] += to_add;
            await contest.save();

        }
    }

});


app.get('/leaderboard/:id', async(req,res) => {
    
    res.set('Access-Control-Allow-Origin', clientEndPoint);
    let contestId = req.params.id;
    let contest = await Contest.findOne({contestId : contestId});

    let leaderboard = []
    for(let participant of contest['participants'])
    {
        let user = await User.findById(participant['participant'])
        user = user['login'];
        leaderboard.push({
            user : user,
            score : participant['score']
        });
    }

    res.json(leaderboard);

})

server.listen(PORT,()=>{
    console.log('Server started on port: ',PORT);
});