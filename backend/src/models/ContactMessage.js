const mongoose = require("mongoose");

// Messages sent from the website's contact form. Read them in MongoDB Atlas
// (Browse Collections → contactmessages) until an admin inbox exists.
const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    message: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    // Set when the sender was signed in.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["new", "read", "replied"], default: "new", index: true },
  },
  { timestamps: true }
);

contactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ContactMessage", contactMessageSchema);
