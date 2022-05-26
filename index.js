const express = require("express");
const mysql = require("mysql");
const cors = require("cors");

const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");
const moment = require('moment');

var fs = require('fs');

const app = express();
app.use(express.static("./public"))
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
}));

app.use(bodyParser.urlencoded({ extended: true }));

const db = mysql.createConnection({
    user: "root",
    host: "localhost",
    password: "",
    database: "almconnect"
});

app.get('/getDataById', (req, res) => {
    const loginid = req.query.loginid;

    db.query("SELECT * FROM users WHERE id=?", [loginid], (err, result) => {

        if (!err) {
            res.send(result);
        } else {
            res.send(err);
        }
    });
});

app.post('/register', (req, res) => {
    const loginid = req.body.loginid;
    const fullname = req.body.fullname;
    const dob = req.body.dob;
    const gender = req.body.gender;
    const mobile = req.body.mobile;
    const email = req.body.email;
    const password = req.body.password;
    const rePassword = req.body.rePassword;
    const address = req.body.address;
    const aboutu = req.body.aboutu;
    const hobbies = req.body.hobbies;
    const profile_pic = "/images/" + gender + ".jpg";

    db.query("INSERT INTO users (id,fullname,dob,gender,mobile,email,password,address,aboutu,hobbies,profile_pic) VALUES(?,?,?,?,?,?,?,?,?,?,?)", [loginid, fullname, dob, gender, mobile, email, password, address, aboutu, hobbies, profile_pic], (err, result) => {
        if (err) {
            res.send(err);
        } else {
            var dir = './public/users/' + loginid;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            res.send({ result, message: "Account Created Successfully." });
        }
    })
});

app.get("/getcolleges", (req, res) => {
    db.query("SELECT * FROM pages WHERE type=?", ["Educational"], (err, result) => {
        if (!err) {
            res.send(result);
        } else {
            res.send(err);
        }
    });
});

app.post('/login', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    db.query("SELECT * FROM users WHERE email=? AND password=?", [email, password], (err, result) => {
        if (err) {
            res.send({ err: err })
        }
        else {
            if (result.length > 0) {
                res.send(result);
            } else {
                res.send({ message: "Wrong email/password combination!!!" });
            }
        }
    })
});

var newPostStorage = multer.diskStorage({
    destination: (req, file, callBack) => {
        const path = `./public/users/${req.headers.loginid}`;
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
        callBack(null, path);     // './public/images/' directory name where save the file
    },
    filename: (req, file, callBack) => {
        callBack(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
})
const newPostUpload = multer({
    storage: newPostStorage
}).single("file");

app.post("/newPost", (req, res) => {
    newPostUpload(req, res, (err) => {
        const postText = req.body.postText;
        const author = req.body.author;
        const authorType = req.body.authorType;

        if (req.file) {
            const postimg = '/users/' + author + "/" + req.file.filename;

            db.query("INSERT INTO posts (posttext,authorType,author,postimg) VALUES(?,?,?,?)", [postText, authorType, author, postimg], (err, result) => {
                if (!err) {
                    db.query("INSERT INTO notifications (noti_text,userid_from,userid_to,status) VALUES(?,?,?,?)", ["NewPost", author, result.insertId, "Unread"], (err, result) => {
                        if (!err) { res.send({ message: "Post Uploaded Successfully." }); }
                    })
                } else {
                    res.send({ message: "Unable To Post!!!" });
                }
            });
        } else {
            db.query("INSERT INTO posts (posttext,authorType,author) VALUES(?,?,?)", [postText, authorType, author], (err, result) => {
                if (!err) {
                    db.query("INSERT INTO notifications (noti_text,userid_from,userid_to,status) VALUES(?,?,?,?)", ["NewPost", author, result.insertId, "Unread"], (err, result) => {
                        if (!err) { res.send({ message: "Post Uploaded Successfully." }); }
                    })
                } else {
                    res.send({ message: "Unable To Post!!!" });
                }
            });
        }
    })
});

app.get("/getAllPosts", (req, res) => {
    const loginid = req.query.loginid;

    const q = `SELECT posts.*,users.fullname,users.id as loginid,users.profile_pic FROM posts INNER JOIN users ON posts.author=users.id WHERE posts.author=? OR posts.author IN 
              (
                  SELECT connections.user1 from connections where connections.user2=? and connections.status='Accepted'
                  UNION ALL 
                  SELECT connections.user2 from connections where connections.user1=? and connections.status='Accepted'
              ) ORDER BY id DESC`;

    db.query(q, [loginid, loginid, loginid], (err, result) => {
        if (!err) {
            result.map((ele, i, row) => {
                db.query("SELECT COUNT(*) as cnt FROM `likes` WHERE type='Post' AND typeId=?", [ele.id], (err3, result3) => {
                    if (!err3) {
                        if (result3.length > 0) {
                            result[i].likePostCount = result3[0].cnt;
                        }
                    } else {
                        console.log(err3)
                    }
                })
                db.query("SELECT * FROM likes WHERE type='Post' AND typeId=? AND likedById=?", [ele.id, loginid], (err1, result1) => {
                    if (!err1) {
                        if (result1.length > 0) {
                            result[i].likePostStatus = true
                        }
                    } else {
                        console.log(err1)
                    }
                })

                db.query("SELECT comments.*,users.fullname,users.profile_pic FROM comments INNER JOIN users ON users.id=comments.commentedBy WHERE postId=?", [ele.id], (err2, result2) => {
                    if (!err2) {
                        result[i].comments = result2

                        // Status of Coment Like And Count of Comment
                        if (result2.length > 0) {
                            result2.map((comment, j, row1) => {
                                db.query("SELECT COUNT(*) as cnt FROM `likes` WHERE type='Comment' AND typeId=?", [comment.id], (err4, result4) => {
                                    if (!err4) {
                                        if (result4.length > 0) {
                                            result[i].comments[j].likeCommentCount = result4[0].cnt;
                                        }
                                    } else {
                                        console.log(err4)
                                    }
                                })
                                db.query("SELECT * FROM likes WHERE type='Comment' AND typeId=? AND likedById=?", [comment.id, loginid], (err5, result5) => {
                                    if (!err5) {
                                        if (result5.length > 0) {
                                            result[i].comments[j].likeCommentStatus = true
                                        }
                                        if (i + 1 == row.length && j + 1 == row1.length) res.send(result)
                                    } else {
                                        console.log(err5)
                                    }
                                })
                            })
                        } else {
                            if (i + 1 == row.length) res.send(result)
                        }

                    } else {
                        console.log(err2)
                    }
                })
            })
        } else {
            res.send(err);
        }
    });
});

app.get("/getPostById", (req, res) => {
    const postid = req.query.postid;
    const loginid = req.query.loginid;

    let q = "SELECT posts.*, users.fullname, users.profile_pic FROM posts INNER JOIN users on users.id=posts.author WHERE posts.id=?";
    if (req.query.authorType && req.query.authorType === "Page") {
        q = "SELECT posts.*, pages.name, pages.logo, pages.id as pageId FROM posts INNER JOIN pages ON pages.id=posts.author WHERE posts.id=?";
    }

    db.query(q, [postid], (err, result) => {
        if (!err) {
            const ele = result[0]
            if (ele) {
                db.query("SELECT COUNT(*) as cnt FROM `likes` WHERE type='Post' AND typeId=?", [ele.id], (err1, result1) => {
                    if (!err1) {
                        if (result1.length > 0) {
                            result[0].likePostCount = result1[0].cnt;
                        }
                    } else {
                        console.log(err1)
                    }
                })
                db.query("SELECT * FROM likes WHERE type='Post' AND typeId=? AND likedById=?", [ele.id, loginid], (err2, result2) => {
                    if (!err2) {
                        if (result2.length > 0) {
                            result[0].likePostStatus = true
                        }
                    } else {
                        console.log(err2)
                    }
                })

                db.query("SELECT comments.*,users.fullname,users.profile_pic FROM comments INNER JOIN users ON users.id=comments.commentedBy WHERE postId=?", [ele.id], (err2, result2) => {
                    if (!err2) {
                        result[0].comments = result2

                        // Status of Coment Like And Count of Comment
                        if (result2.length > 0) {
                            result2.map((comment, j, row1) => {
                                db.query("SELECT COUNT(*) as cnt FROM `likes` WHERE type='Comment' AND typeId=?", [comment.id], (err4, result4) => {
                                    if (!err4) {
                                        if (result4.length > 0) {
                                            result[0].comments[j].likeCommentCount = result4[0].cnt;
                                        }
                                    } else {
                                        console.log(err4)
                                    }
                                })
                                db.query("SELECT * FROM likes WHERE type='Comment' AND typeId=? AND likedById=?", [comment.id, loginid], (err5, result5) => {
                                    if (!err5) {
                                        if (result5.length > 0) {
                                            result[0].comments[j].likeCommentStatus = true
                                        }
                                        if (j + 1 == row1.length) res.send(result)
                                    } else {
                                        console.log(err5)
                                    }
                                })
                            })
                        } else {
                            res.send(result)
                        }

                    } else {
                        console.log(err2)
                    }
                })
            }
        } else {
            res.send(err);
        }
    })
})

app.get("/getUserPosts", (req, res) => {
    const author = req.query.author;

    db.query("SELECT posts.*, users.fullname FROM posts INNER JOIN users ON users.id=posts.author WHERE posts.author=? ORDER BY posts.id DESC", [author], (err, result) => {
        if (!err) {
            res.send(result);
        } else {
            res.send(err);
        }
    });
});

app.get("/getPagePosts", (req, res) => {
    const author = req.query.author;

    db.query("SELECT posts.*, pages.logo,pages.name FROM posts INNER JOIN pages ON pages.id=posts.author WHERE author=? AND authorType=? ORDER BY posts.id DESC", [author, "Page"], (err, result) => {
        if (!err) {
            result.map((ele, i, row) => {
                db.query("SELECT COUNT(*) as cnt FROM `likes` WHERE type='Post' AND typeId=?", [ele.id], (err3, result3) => {
                    if (!err3) {
                        if (result3.length > 0) {
                            result[i].likePostCount = result3[0].cnt;
                        }
                    } else {
                        console.log(err3)
                    }
                })
                db.query("SELECT * FROM likes WHERE type='Post' AND typeId=? AND likedById=?", [ele.id, author], (err1, result1) => {
                    if (!err1) {
                        if (result1.length > 0) {
                            result[i].likePostStatus = true
                        }
                    } else {
                        console.log(err1)
                    }
                })

                db.query("SELECT comments.*,users.fullname,users.profile_pic FROM comments INNER JOIN users ON users.id=comments.commentedBy WHERE postId=?", [ele.id], (err2, result2) => {
                    if (!err2) {
                        result[i].comments = result2

                        // Status of Coment Like And Count of Comment
                        if (result2.length > 0) {
                            result2.map((comment, j, row1) => {
                                db.query("SELECT COUNT(*) as cnt FROM `likes` WHERE type='Comment' AND typeId=?", [comment.id], (err4, result4) => {
                                    if (!err4) {
                                        if (result4.length > 0) {
                                            result[i].comments[j].likeCommentCount = result4[0].cnt;
                                        }
                                    } else {
                                        console.log(err4)
                                    }
                                })
                                db.query("SELECT * FROM likes WHERE type='Comment' AND typeId=? AND likedById=?", [comment.id, author], (err5, result5) => {
                                    if (!err5) {
                                        if (result5.length > 0) {
                                            result[i].comments[j].likeCommentStatus = true
                                        }
                                        if (i + 1 == row.length && j + 1 == row1.length) res.send(result)
                                    } else {
                                        console.log(err5)
                                    }
                                })
                            })
                        } else {
                            if (i + 1 == row.length) res.send(result)
                        }

                    } else {
                        console.log(err2)
                    }
                })
            })
        } else {
            res.send(err);
        }
    });
});

app.post("/uploadProfile", (req, res) => {
    newPostUpload(req, res, (err1) => {
        if (!req.file) {
            res.send({ message: "No File Upload!!!" });
        } else {
            const loginid = req.body.loginid;
            const img = "/users/" + loginid + "/" + req.file.filename;
            const datetime = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss');
            db.query("UPDATE users SET profile_pic=?,updatedat=? WHERE id=?", [img, datetime, loginid], (err, result) => {
                if (!err) {
                    var imgsrc = 'http://127.0.0.1:3001/images/' + req.file.filename;
                    res.send({ message: "File Uploaded", uploadedFileName: imgsrc });
                } else {
                    res.send({ message: "Error" });
                }
            })
        }
    });
});
app.post("/addEducation", (req, res) => {
    const userid = req.body.userid;
    const school = req.body.educationDetail.school;
    const degree = req.body.educationDetail.degree;
    const fieldofstudy = req.body.educationDetail.fieldofstudy;
    const startdate = req.body.educationDetail.startdate;
    const enddate = req.body.educationDetail.enddate;
    const description = req.body.educationDetail.description == null ? "" : req.body.educationDetail.description;

    db.query("INSERT INTO user_educations (userid,school,degree,fieldofstudy,startdate,enddate,description) VALUES(?,?,?,?,?,?,?)", [userid, school, degree, fieldofstudy, startdate, enddate, description], (err, result) => {
        if (!err) {
            res.send(result);
        } else {
            res.send(err);
        }
    });
});

app.get("/getUserEducations", (req, res) => {
    const loginid = req.query.loginid;

    db.query("SELECT * FROM user_educations WHERE userid=?", [loginid], (err, result) => {
        if (!err) {
            res.send(result);
        } else {
            res.send(err);
        }
    });
});

// Admin Module API's
app.post("/adminlogin", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    db.query("SELECT * FROM admin WHERE username=? AND password=?", [username, password], (err, result) => {
        if (!err) {
            if (result.length > 0)
                res.send(result);
            else
                res.send({ message: "Username or Password is Incorrent!!!" });
        } else {
            res.send(err);
        }
    });
});


// Add College
var addCollegeStorage = multer.diskStorage({
    destination: (req, file, callBack) => {
        callBack(null, './public/colleges/');     // './public/images/' directory name where save the file
    },
    filename: (req, file, callBack) => {
        callBack(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
})
var addCollegeUpload = multer({
    storage: addCollegeStorage
});
app.post("/addcollege", addCollegeUpload.single('file'), (req, res) => {
    const name = req.body.collegeName;
    const address = req.body.collegeAddress;
    const filename = '/colleges/' + req.file.filename;

    db.query("INSERT INTO colleges (name,address,photo,status) VALUES(?,?,?,?)", [name, address, filename, "Approved"], (err, result) => {
        if (!err) {
            res.send(result);
        } else {
            res.send(err);
        }
    });
})

// Get Follow Btn Status
app.get("/getFollowers", (req, res) => {
    const user1 = req.query.user1;

    db.query("SELECT connections.*,users.fullname FROM connections INNER JOIN users ON users.id=user1 WHERE user2=? AND status='Accepted'", [user1], (err, result) => {
        !err ? res.send(result) : res.send(err);
    });
});
app.get("/getFollowing", (req, res) => {
    const user1 = req.query.user1;

    db.query("SELECT connections.*,users.fullname FROM connections INNER JOIN users ON users.id=user2 WHERE user1=? AND status='Accepted'", [user1], (err, result) => {
        !err ? res.send(result) : res.send(err);
    });
});

app.get("/getUserFollowStatus", (req, res) => {
    const user1 = req.query.user1;
    const user2 = req.query.user2;

    db.query("SELECT * FROM connections WHERE user1=? AND user2=?", [user1, user2], (err, result) => {
        !err ? res.send(result) : res.send(err);
    });
});
app.post("/sendFollowRequest", (req, res) => {
    const user1 = req.body.user1;
    const user2 = req.body.user2;
    let status = "Pending";
    let already = "No";
    const noti_text = "FollowRequest";

    db.query("SELECT * FROM connections WHERE user1=? AND user2=? AND status=?", [user2, user1, "Accepted"], (err, result) => {
        if (result.length > 0) {
            status = "Accepted";
            already = "Yes";
        }
        db.query("INSERT INTO connections (user1,user2,status) VALUES(?,?,?)", [user1, user2, status], (err, result) => {
            if (!err) {
                db.query("INSERT INTO notifications (noti_text,userid_from,userid_to,status) VALUES(?,?,?,?)", [noti_text, user1, user2, "Unread"], (err, result) => {
                    if (!err) res.send({ result: result, myStatus: already });
                    else res.send(err);
                })
            } else {
                res.send(err);
            }
        });
    });
});

app.get("/searchUser", (req, res) => {
    const loginid = req.query.loginid;
    const searchVal = req.query.searchVal;

    db.query("SELECT * FROM users WHERE fullname LIKE CONCAT(?,'%') EXCEPT SELECT * FROM users WHERE id=?", [searchVal, loginid], (err, result) => {
        if (!err) {
            db.query("SELECT * FROM pages WHERE name LIKE CONCAT(?,'%')", [searchVal], (err1, result1) => {
                if (!err1) {
                    res.send({ result, result1 })
                }
            });
        }
    });
});

app.get("/getNotifications", (req, res) => {
    const loginid = req.query.loginid;

    db.query("SELECT notifications.*,users.fullname,users.profile_pic from notifications INNER JOIN users ON users.id=notifications.userid_from WHERE userid_to=? OR noti_text='NewPost' ORDER BY id DESC", [loginid], (err, result) => {
        if (!err) res.send(result);
        else res.send(err);
    })
});

app.post("/acceptFriendRequest", (req, res) => {
    const userid_from = req.body.userid_from;
    const userid_to = req.body.userid_to;

    db.query("UPDATE connections SET status=? WHERE user1=? AND user2=?", ["Accepted", userid_from, userid_to], (err, result) => {
        db.query("UPDATE notifications SET status=? WHERE userid_from=? AND userid_to=?", ["Read", userid_from, userid_to], (err1, result1) => {
            if (!err && !err1) res.send(result);
            else res.send(err);
        })
    })
});
app.post("/deleteFriendRequest", (req, res) => {
    const userid_from = req.body.userid_from;
    const userid_to = req.body.userid_to;

    db.query("DELETE FROM connections WHERE user1=? AND user2=?", [userid_from, userid_to], (err, result) => {
        db.query("UPDATE notifications SET status=? WHERE userid_from=? AND userid_to=?", ["Read", userid_from, userid_to], (err1, result1) => {
            if (!err && !err1) res.send(result);
            else res.send(err);
        })
    })
});

app.post("/setPostStatusNotification", (req, res) => {
    const noti_id = req.body.noti_id;

    db.query("UPDATE notifications SET status=? WHERE id=?", ["Read", noti_id], (err1, result1) => {
        if (!err1 && !err1) res.send(result1);
        else res.send(err1);
    })
})


// Pages Related API's
app.get("/getPages", (req, res) => {
    const loginid = req.query.loginid;

    db.query("SELECT * from pages WHERE createdby=?", [loginid], (err, result) => {
        !err ? res.send(result) : res.send(err);
    });
})

var addPageStorage = multer.diskStorage({
    destination: (req, file, callBack) => {
        callBack(null, './public/pages/');     // './public/images/' directory name where save the file
    },
    filename: (req, file, callBack) => {
        callBack(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
})
var addPageUpload = multer({
    storage: addPageStorage
});
app.post("/addPage", addPageUpload.single('file'), (req, res) => {
    const userid = req.body.userid;
    const data = JSON.parse(req.headers.data);

    const name = data[0];
    const type = data[1];
    const address = data[2];
    const phonenumber = data[3] + data[4];
    const email = data[5];
    const foundedyear = data[6];
    const description = data[7];

    const logo = '/pages/' + req.file.filename;


    db.query("INSERT INTO pages (name,type,address,phonenumbers,emails,description,foundedyear,logo,createdby) VALUES(?,?,?,?,?,?,?,?,?)", [name, type, address, phonenumber, email, description, foundedyear, logo, userid], (err, result) => {
        if (!err) {
            res.send(result);
        } else {
            res.send(err);
        }
    });
});



// Comments Section
app.post("/addComment", (req, res) => {
    const loginid = req.body.loginid;
    const commentText = req.body.commentText;
    const postId = req.body.postId;

    db.query("INSERT INTO comments (commentText,postId,commentedBy) VALUES(?,?,?)", [commentText, postId, loginid], (err, result) => {
        if (!err) {
            res.send(result);
        } else {
            res.send(err);
        }
    })
})
app.get("/getComments", (req, res) => {
    const postId = req.query.postId;

    db.query("SELECT comments.*,users.fullname,users.profile_pic FROM comments INNER JOIN users ON users.id=comments.commentedBy WHERE postId=?", [postId], (err, result) => {
        res.send(!err ? result : err);
    })
})


// Like Section
app.get("/getLike", (req, res) => {
    const loginid = req.query.loginid;

    db.query("SELECT * FROM likes WHERE likedById=?", [loginid], (err, result) => {
        res.send(!err ? result : err);
    })
})

app.get("/getLikeCount", (req, res) => {
    const liketype = req.query.liketype;
    const typeid = req.query.typeid;

    db.query("SELECT COUNT(*) as cnt FROM `likes` WHERE type=? AND typeId=?", [liketype, typeid], (err, result) => {
        res.send(!err ? result : err);
    })
})

app.post("/addLike", (req, res) => {
    const loginid = req.body.loginid;
    const liketype = req.body.liketype;
    const typeid = req.body.typeid;

    db.query("INSERT INTO likes (type,typeId,likedById) VALUES(?,?,?)", [liketype, typeid, loginid], (err, result) => {
        res.send(!err ? result : err);
    })
})
app.post("/deleteLike", (req, res) => {
    const loginid = req.body.loginid;
    const liketype = req.body.liketype;
    const typeid = req.body.typeid;

    db.query("DELETE FROM likes WHERE type=? AND typeId=? AND likedById=?", [liketype, typeid, loginid], (err, result) => {
        res.send(!err ? result : err);
    })
})

// Page URL's
app.get("/getPageById", (req, res) => {
    const pageid = req.query.pageid;

    db.query("SELECT * FROM pages WHERE id=?", [pageid], (err, result) => {
        res.send(!err ? result : err)
    })
})

//Messages
app.get("/getMessageUsers", (req, res) => {
    const loginid = req.query.loginid;

    const q = "(SELECT messageUsers.*, users.fullname,users.profile_pic FROM messageUsers INNER JOIN users on users.id=messageUsers.reciever WHERE sender=? UNION SELECT messageUsers.*, users.fullname,users.profile_pic FROM messageUsers INNER JOIN users on users.id=messageUsers.sender WHERE reciever=?) ORDER BY lastUpdate DESC;";

    db.query(q, [loginid, loginid], (err, result) => {
        if(!err && result.length>0){
            result.map((ele,i,row)=>{
                if(ele.sender == loginid){
                    db.query("SELECT * FROM messages WHERE (sender=? AND reciever=?) OR (reciever=? AND sender=?) ORDER BY id DESC LIMIT 1", [loginid,ele.reciever,loginid,ele.reciever], (err1,result1)=>{
                        if(!err1){
                            result[i].lastMsg = result1[0];
                        }
                        if(i+1==row.length) res.send(result)
                    })
                } else if(ele.reciever == loginid){
                    db.query("SELECT * FROM messages WHERE (sender=? AND reciever=?) OR (reciever=? AND sender=?) ORDER BY id DESC LIMIT 1", [loginid,ele.sender,loginid,ele.sender], (err1,result1)=>{
                        if(!err1){
                            result[i].lastMsg = result1[0];
                        }
                        if(i+1==row.length) res.send(result)
                    })
                }
            })
        }
    })
})

app.get("/getMessages", (req, res) => {
    const id = req.query.id;
    const loginid = req.query.loginid;

    db.query("SELECT * FROM messages WHERE (sender=? AND reciever=?) OR (reciever=? AND sender=?)", [id, loginid, id, loginid], (err, result) => {
        res.send(!err ? result : err)
    })
})

app.post("/sendMessage", (req, res) => {
    const sender = req.body.sender;
    const reciever = req.body.reciever;
    const msg = req.body.msg;

    db.query("SELECT * FROM messageUsers WHERE (sender=? AND reciever=?) OR (reciever=? AND sender=?)", [sender, reciever, sender, reciever], (err2, result2) => {
        
        db.query("INSERT INTO messages (sender,reciever,message) VALUES(?,?,?)", [sender, reciever, msg], (err, result) => {
            
            if (result2.length > 0) {
                db.query("UPDATE messageUsers SET lastUpdate=? WHERE (sender=? AND reciever=?) OR (reciever=? AND sender=?)", [new Date(), sender, reciever, sender, reciever], (err1, result1) => {
                    res.send(!err && !err1 ? result : err)
                })
            } else {
                db.query("INSERT INTO messageUsers (sender,reciever) VALUES(?,?)", [sender, reciever], (err1, result1) => {
                    res.send(!err && !err1 ? result : err)
                })
            }
        })
    })
})

app.listen(3001, () => {
    console.log("Running Server");
});