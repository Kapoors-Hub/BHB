// services/notificationService.js
const transporter = require('../config/mailer');
const Hunter = require('../models/Hunter');

const notificationService = {
  /**
   * Send email notification to all verified hunters about a new bounty
   * @param {Object} bounty - The newly posted bounty
   * @param {Object} lord - The lord who posted the bounty
   */
  async sendNewBountyNotification(bounty, lord) {
    try {
      // Get all verified hunters
      const hunters = await Hunter.find({
        status: 'verified',
        isVerified: true
      }).select('name collegeEmail');

      if (hunters.length === 0) {
        console.log('No verified hunters found to notify');
        return;
      }

      // Extract all email addresses
      const allEmails = hunters.map(h => h.collegeEmail);

      // Format dates for email
      const startDate = new Date(bounty.startTime).toLocaleDateString();
      const endDate = new Date(bounty.endTime).toLocaleDateString();

      // Create email content
      const subject = `New Bounty Available: ${bounty.title}`;

      const emailText = `
Hello Hunters,

A new bounty has been posted by ${lord.firstName} ${lord.lastName} (${lord.username}):

Title: ${bounty.title}
Reward: ${bounty.rewardPrize}
Duration: ${bounty.days} days (${startDate} to ${endDate})

${bounty.context.substring(0, 200)}${bounty.context.length > 200 ? '...' : ''}

Log in to your account to view more details and register for this bounty.

Best regards,
The Bounty Hunter Platform Team
      `;

      // Send a single email with BCC to all hunters
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        bcc: allEmails, // Use BCC to hide recipients from each other
        subject: subject,
        text: emailText
      });

      console.log(`New bounty notification sent to ${hunters.length} hunters via BCC`);
    } catch (error) {
      console.error('Error sending bounty notifications:', error);
    }
  }
};

module.exports = notificationService;