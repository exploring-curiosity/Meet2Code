const express=require("express");
      router=express.Router();
      fetch=require("node-fetch");
      mongoose=require("mongoose");
      User=require("../Schemas/user");
const { clientEndPoint} = require("../config");

//Router to get additional permission for repository operations
router.get('/oauth/repos',async(req,res)=>{

    res.set('Access-Control-Allow-Origin', clientEndPoint);
    let {gitaccess}=req.session 
    if(gitaccess!==undefined && gitaccess!==null && gitaccess.fetched===true){      //If the resources are already fetched
        return res.redirect(`${clientEndPoint}/room/${req.session.roomId}?repo_access_granted=true`)
    }

    let roomId=req.query.roomId;
    req.session.roomId=roomId;
    return  res.redirect('https://github.com/login/oauth/authorize?client_id='+gitConfig.clientId+'&scope=public_repo&redirect_uri='+serverEndPoint+'/oauth/gitCallBack/getRepos');
})

//Router to get repo info
router.get('/repos',async(req,res)=>{

    res.set('Access-Control-Allow-Origin', clientEndPoint);
    let {gitaccess}=req.session             //Get user git auth details

   
    if(gitaccess.fetched===true){
        res.status(200).json({repos:gitaccess.repos})
        return
    }

    let resp=await fetch(`https://api.github.com/users/${gitaccess.login}/repos`)   //Get the repositories of the user
    resp=await resp.json()

    let repos=[]
    for(let repo of resp)
        repos.push({
            name:`${repo.name}`,
            html_url:`${repo.html_url}`,
            url:`${repo.url}`
        })

    req.session.gitaccess.fetched=true      //Repos are fetched from git
    req.session.gitaccess.repos=repos       //Set the fetched repos
    res.status(200).json({repos:repos})

})
const { gitConfig , serverEndPoint, clientEndPoint} = require("../config");
module.exports=router