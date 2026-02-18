
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ===== CONFIG =====
const DB_PATH = process.env.DB_PATH || "./websites.json"; // can set to Google Drive mounted path
const CHECK_INTERVAL = 500;

// ===== DB =====
function loadDB(){
  if(!fs.existsSync(DB_PATH)){
    fs.writeFileSync(DB_PATH, JSON.stringify({sites:[]},null,2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH));
}
function saveDB(data){
  fs.writeFileSync(DB_PATH, JSON.stringify(data,null,2));
}

let db = loadDB();

// ===== MONITOR =====
async function checkSite(site){
  const start = Date.now();
  try{
    await axios.get(site.url,{timeout:5000});
    const rt = Date.now()-start;
    site.status="up";
    site.lastResponse=rt;
    site.history.push({t:Date.now(),rt,status:"up"});
  }catch{
    site.status="down";
    site.lastResponse=null;
    site.history.push({t:Date.now(),rt:null,status:"down"});
  }
  // keep 24h
  const cutoff = Date.now()-86400000;
  site.history = site.history.filter(h=>h.t>cutoff);
}

setInterval(async ()=>{
  db = loadDB();
  for(let s of db.sites){
    if(!s.history) s.history=[];
    await checkSite(s);
  }
  saveDB(db);
},CHECK_INTERVAL);

// ===== API =====
app.get("/api/status",(req,res)=>{
  db=loadDB();
  const up=db.sites.filter(s=>s.status==="up").slice(0,5);
  const down=db.sites.filter(s=>s.status==="down").slice(0,5);
  res.json({up,down});
});

app.get("/api/all",(req,res)=>{
  db=loadDB();
  res.json(db.sites);
});

app.post("/api/add",(req,res)=>{
  const {url}=req.body;
  db=loadDB();
  if(!db.sites.find(s=>s.url===url)){
    db.sites.push({url,status:"unknown",lastResponse:null,history:[]});
    saveDB(db);
  }
  res.json({ok:true});
});

app.post("/api/remove",(req,res)=>{
  const {url}=req.body;
  db=loadDB();
  db.sites=db.sites.filter(s=>s.url!==url);
  saveDB(db);
  res.json({ok:true});
});

app.get("/api/check", async(req,res)=>{
  const url=req.query.url;
  try{
    const start=Date.now();
    await axios.get(url,{timeout:5000});
    res.json({status:"up",response:Date.now()-start});
  }catch{
    res.json({status:"down"});
  }
});

app.use(express.static(path.join(__dirname,"public")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public/index.html")));

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log("running "+PORT));
