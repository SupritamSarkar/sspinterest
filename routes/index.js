var express = require("express");
var router = express.Router();
const userModel = require("../models/users"); // User model
const postModel = require("../models/post");
const passport = require("passport");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Post = require("../models/post");







const localStrategy = require("passport-local");
passport.use(new localStrategy(userModel.authenticate()));

// ✅ Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../public/uploads/");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const filename = Date.now() + path.extname(file.originalname);
    cb(null, filename);
  },
});

const upload = multer({ storage });



/* 🌟 ROUTES */

// 🏠 Home Page
router.get("/", (req, res) => {
  res.render("register");
});

// 🔑 Login Page
router.get("/login", (req, res) => {
  res.render("login");
});

// profile page
router.get("/profile", async (req, res) => {
  try {

    if (!req.user) {
      return res.redirect("/login");
    }

    // Fetch user posts
    const userPosts = await Post.find({ _id: { $in: req.user.posts } });


    res.render("profile", { userdata: req.user, posts: userPosts || [] });
  } catch (error) {
    console.error("❌ Profile Page Error:", error); // Log error message
    res.status(500).send(`<pre>${error.stack}</pre>`); // Show full error in the browser
  }
});




// 🌎 Feed Page
router.get("/home", async (req, res) => {
  try {
    let posts = await postModel.find().populate("user"); // Fetch all posts with user info
    res.render("home", { posts });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).send("Error loading feed");
  }
});


// 📝 Register User
router.post("/register", async (req, res) => {
  const userdata = new userModel({
    username: req.body.username,
    email: req.body.email,
    fullName: req.body.fullName,
    profilePic: "/uploads/default-profile.png", // ✅ Set default profile picture
  });

  await userModel.register(userdata, req.body.password);

  passport.authenticate("local")(req, res, function () {
    res.redirect("/profile");
  });
});

// 🔓 Login User
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/profile",
    failureRedirect: "/login",
  })
);

// 🚪 Logout User
router.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    
        req.session.destroy(function (err) {
      if (err) {
        return next(err);
      }
    res.clearCookie("connect.sid"); // Clear the session cookie
    res.redirect("/");
        });
  })
});

// 📸 ✅ Upload & Save Profile Picture to Database
router.post("/update-profile-pic", upload.single("profilePic"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded." });
  }

  const profilePicUrl = "/uploads/" + req.file.filename; // Image URL

  try {
    // ✅ Update the profilePic field in MongoDB
    const updatedUser = await userModel.findByIdAndUpdate(
      req.user._id,
      { profilePic: profilePicUrl },
      { new: true }
    );

    res.json({ success: true, profilePic: updatedUser.profilePic });
  } catch (error) {
    console.error("Error updating profile picture:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



// 📸 ✅ Upload & Save Post to Database
router.post("/upload-post", isLoggedIn, upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded." });
  }

  try {
    // ✅ Generate correct URL for the uploaded image
    const imageUrl =  "/uploads/" + req.file.filename;

    // ✅ Create the new post
    const newPost = await postModel.create({
      imageUrl: imageUrl,
      postText: req.body.postText || "",
      user: req.user._id,
    });

    // ✅ Update the user's posts array
    await userModel.findByIdAndUpdate(req.user._id, {
      $push: { posts: newPost._id }
    });

    // ✅ Send success response
    res.json({ success: true, imageUrl: newPost.imageUrl, postId: newPost._id });

  } catch (error) {
    console.error("❌ Upload Error:", error);
    res.status(500).json({ success: false, message: "Error uploading post." });
  }
});



// 🚮 Delete Post
router.delete("/delete-post/:id", async (req, res) => {
  try {
    const post = await postModel.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // ✅ Get correct file path
    const filename = post.imageUrl.split("/uploads/")[1]; // Extract filename from URL
    const imagePath = path.join(__dirname, "../public/uploads", filename); // Construct full path to the image

    // ✅ Delete the image file from the uploads folder
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      console.log("✅ Image deleted:", imagePath);
    } else {
      console.log("⚠️ Image not found:", imagePath);
    }

    // ✅ Remove the post from the user's posts array
    await userModel.findByIdAndUpdate(post.user, { $pull: { posts: req.params.id } });

    // ✅ Delete the post from MongoDB
    await postModel.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ success: false, message: "Error deleting post" });
  }
});


// Like Post Route
router.post("/like/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false });

    if (post.likes.includes(req.user.id)) {
      post.likes = post.likes.filter(id => id.toString() !== req.user.id);
    } else {
      post.likes.push(req.user.id);
    }

    await post.save();
    res.json({ success: true, likes: post.likes.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ✅ Add Comment to a Post
router.post("/comment/:postId", isLoggedIn, async (req, res) => {
  try {
    const { text } = req.body;
 

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });




  
    post.comments.push({
      user: req.user._id,
      username: req.user.username,
      text,
    });

    await post.save();
const updatedPost = await Post.findById(req.params.postId);

// ✅ Save post after adding comment


    res.json({ success: true, username: req.user.username, text });
  } catch (err) {
    console.error("Error saving comment:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 🖼️ Route to display a single post's details
router.get("/post/:id", async (req, res) => {
  try {
    const post = await postModel.findById(req.params.id).populate("user").populate("comments.user");
    if (!post) {
      return res.status(404).send("Post not found");
    }
    res.render("postDetails", { post });
  } catch (error) {
    console.error("Error fetching post details:", error);
    res.status(500).send("Error loading post details");
  }
});

router.get("/postDetailAll/:id", async (req, res) => {
  try {
    const post = await postModel.findById(req.params.id).populate("user").populate("comments.user");
    
    if (!post) return res.status(404).send("Post not found");

    res.render("postDetailAll", { post });  // ✅ Render the correct EJS page
  } catch (error) {
    console.error("Error fetching post details:", error);
    res.status(500).send("Error loading post details");
  }
});




// 🔒 Middleware: Check if User is Logged In
function isLoggedIn(req, res, next) {

  if (req.isAuthenticated()) return next();
  res.redirect("/");
}


module.exports = router;
