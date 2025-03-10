const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  hunter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hunter',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['bounty', 'quiz', 'level', 'pass', 'foul', 'system', 'achievement'],
    required: true
  },
  relatedItem: {
    // Could be a bounty ID, quiz ID, etc.
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'itemModel'
  },
  itemModel: {
    // Model name for the related item
    type: String,
    enum: ['Bounty', 'Quiz', 'FoulRecord', 'Pass', null]
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 30 * 24 * 60 * 60 // Expire notifications after 30 days
  }
});

// Index for faster retrieval of hunter's notifications
notificationSchema.index({ hunter: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

// 44fb4129-959e-41b0-93f2-faf4c8d0780b