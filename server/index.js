const express = require("express");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const User = require("./models/User");
const Message = require("./models/Message");
const ws = require("ws");
const fs = require("fs");
const { setTimeout } = require("timers/promises");
const { resolve } = require("path");
const { rejects } = require("assert");

dotenv.config(); //เพื่อเรียกใช้ไฟล์ .env
const app = express();

app.use(cors({ credentials: true, origin: "http://localhost:5173" }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

//Connect mongo
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI).then((success) => {
  if (!success) console.log(success);
});

//ไว้ตรวจสอบการเชื่อมต่อฐานข้อมูล
app.get("/", (req, res) => {
  res.send("This is a Restful api Mern-Chat");
});

//Register
const salt = bcrypt.genSaltSync(10);
app.post("/register", async (req, res) => {
  const { username, password } = req.body; // สลายโครงสร้าง
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

//Login
const secret = process.env.SECRET;
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username }); //เอา username ไปหาข้อมูลจากฐานข้อมูล
  if (userDoc) {
    const isMatchedPassword = bcrypt.compareSync(password, userDoc.password); //เช็ค พาส ที่ได้จากฟอร์ม และในฐานข้อมูลว่าเหมือนกันไหม
    if (isMatchedPassword) {
      jwt.sign({ username, userId: userDoc._id }, secret, {}, (err, token) => {
        if (err) throw err;

        res.cookie("token", token).json({
          userId: userDoc._id,
          username,
        });
      });
    } else {
      res.status(400).json("wrong credentials");
    }
  } else {
    res.status(400).json("user not found");
  }
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

app.get("/profile", (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    jwt.verify(token, secret, {}, (err, userData) => {
      if (err) throw err;
      res.json(userData);
    });
  } else {
    res.status(401).json("no token");
  }
});

app.get("/people", async (req, res) => {
  const users = await User.find({}, { _id: 1, username: 1 });
  res.json(users);
});

const getUserDataFromRequest = (req) => {
  return new Promise((resolve, rejects) => {
    const token = req.cookies?.token;
    if (token) {
      jwt.verify(token, secret, {}, (err, userData) => {
        if (err) throw err;
        resolve(userData);
      });
    } else {
      rejects("No Token");
    }
  });
};
app.get("/messages/:userId", async (req, res) => {
  const { userId } = req.params;
  const userData = await getUserDataFromRequest(req);
  const ourUserId = userData.userId;
  const messages = await Message.find({
    sender: { $in: [userId, ourUserId] },
    recipient: { $in: [userId, ourUserId] },
  }).sort({ createAt: 1 });
  res.json(messages);
});

//เป็นตัวบอกว่ามาจาก PORTไหน โดยดึงมาจากไฟล์ env
const PORT = process.env.PORT;
const server = app.listen(PORT, () => {
  console.log("Server is running on" + PORT);
});
//Web Socket Server
const wss = new ws.WebSocketServer({ server });

wss.on("connection", (connection, req) => {
  const notifyAboutOnlinePeople = () => {
    [...wss.clients].forEach((client) => {
      client.send(
        JSON.stringify({
          online: [...wss.clients].map((c) => ({
            userId: c.userId,
            username: c.username,
          })),
        })
      );
    });
  };
  connection.isAlive = true;
  connection.timer = setInterval(() => {
    connection.ping();
    connection.deadTimer = setTimeout(() => {
      clearInterval(connection.timer);
      connection.terminate();
      notifyAboutOnlinePeople();
      console.log("dead");
    }, 1000);
  }, 5000);

  connection.on("pong", () => {
    clearTimeout(connection.deadTimer);
  });
  //read username and id from the cookie for this connection
  const cookies = req.headers.cookie;
  if (cookies) {
    const tokenCookieString = cookies
      .split(";")
      .find((str) => str.startsWith("token="));
    if (tokenCookieString) {
      const token = tokenCookieString.split("=")[1];
      if (token) {
        jwt.verify(token, secret, {}, (err, userData) => {
          if (err) throw err;
          const { userId, username } = userData;
          connection.userId = userId;
          connection.username = username;
        });
      }
    }
  }
  connection.on("message", async (message) => {
    const messageData = JSON.parse(message.toString());
    const { recipient, sender, text, file } = messageData;
    let filename = null;
    if (file) {
      //ใช้splitเพื่อแยกนามสกุลไฟล์กับชื่อออกไป
      const parts = file.name.split(".");
      const ext = parts[parts.length - 1];
      filename = Date.now() + "." + ext;
      //เก็บไฟล์ในuploads
      const path = __dirname + "/uploads/" + filename;
      //ป้องกันการอัพโหลดไฟล์ชื่อซ้ำ
      //const bufferData = new Buffer(file.name.data.split(",")[1], "base64");
      fs.writeFile(path, file.data.split(",")[1], "base64", () => {
        console.log("file saved: " + path);
      });
    }
    
    if (recipient && (text || file)) {
      const messageDoc = await Message.create({
        sender: connection.userId,
        recipient,
        text,
        file: file ? filename : null,
      });
      [...wss.clients]
        .filter((c) => c.userId === recipient)
        .forEach((c) =>
          c.send(
            JSON.stringify({
              text,
              file: file ? filename : null,
              sender: connection.userId,
              recipient,
              _id: messageDoc._id,
            })
          )
        );
    }
  });

  notifyAboutOnlinePeople();
});
